const fs = require('fs');
// const path = require('path');
const dayjs = require('dayjs');
const { stripIndent } = require('common-tags');

const defaultLocale = 'en:published';
const sitemapCacheName = 'apos-sitemap';

module.exports = {
  options: {
    alias: 'sitemap',
    // Cache sitemaps for 1 hour by default. Depending on page rank Google may
    // look at your sitemap somewhere between daily and monthly, so don't get
    // your hopes up too far about changing this
    cacheLifetime: 60 * 60,
    // The number of pieces to index in each loop.
    piecesPerBatch: 100
  },
  // bundle: {
  //   directory: 'modules',
  //   modules: getBundleModuleNames()
  // },
  init(self, options) {
    self.caching = true;

    self.cacheLifetime = options.cacheLifetime;

    self.piecesPerBatch = options.piecesPerBatch;

    self.baseUrl = options.baseUrl || self.apos.baseUrl;
  },
  tasks (self) {
    return {
      map: {
        usage: 'Generate a sitemap',
        async task (argv) {
          if (argv['update-cache']) {
            self.caching = true;
          } else {
            self.caching = false;
          }

          if (!self.baseUrl) {
            // TODO: Update message
            return new Error(stripIndent`
              You must specify the top-level baseUrl option when configuring Apostrophe
              to use this task. Example: baseUrl: "https://mycompany.com"
              Note there is NO TRAILING SLASH.
              Usually you will only do this in data/local.js, on production.
            `
            );
          }
          return self.map();
        }
      },
      clear: {
        usage: 'Clear the existing sitemap',
        async task (argv) {
          // Just forget the current sitemaps to make room
          // for regeneration on the next request
          return self.apos.cache.clear(sitemapCacheName);
        }
      }
    };
  },
  routes (self) {
    return {
      get: {
        '/sitemap.xml': async function(req, res) {
          return self.sendCache(res, 'sitemap.xml');
        },
        '/sitemaps/*': async function(req, res) {
          return self.sendCache(res, 'sitemaps/' + req.params[0]);
        }
      }
    };
  },
  methods (self, options) {
    return {
      map: async function () {
        // TODO: Get shed of workflow stuff
        self.workflow = self.apos.modules['apostrophe-workflow'];

        const argv = self.apos.argv;

        if (self.caching) {
          self.cacheOutput = [];
        }

        await lock();
        initConfig();
        await map();
        await hreflang();
        await write();
        await unlock();

        async function lock() {
          await self.apos.lock.lock('apos-sitemap');
        }

        function initConfig() {
          self.format = argv.format || options.format || 'xml';

          self.indent = (typeof argv.indent !== 'undefined')
            ? argv.indent
            : options.indent;

          self.excludeTypes = options.excludeTypes || [];

          if (argv['exclude-types']) {
            self.excludeTypes = self.excludeTypes.concat(argv['exclude-types']
              .split(','));
          }

          self.perLocale = options.perLocale || argv['per-locale'];
          // Exception: plaintext sitemaps and sitemap indexes don't go
          // together, so we can presume that if they explicitly ask
          // for plaintext they are just doing content strategy and we
          // should produce a single report
          if (self.format === 'text') {
            self.perLocale = false;
          }
        }

        async function map () {
          self.maps = {};
          self.today = dayjs().format('YYYY-MM-DD');

          const locales = [ defaultLocale ];

          if (self.workflow) {
            // TODO: Workflow stuff
            // locales = _.filter(_.keys(self.workflow.locales), function(locale) {
            //   return !locale.match(/-draft$/) && !self.workflow.locales[locale].private;
            // });
          }

          for (const locale of locales) {
            const req = self.apos.task.getReq();
            req.aposLocale = locale;

            await self.getPages(req);
            await self.getPieces(req);
            // TODO: Add support for self.custom method.
          }
        }

        function hreflang() {

          const alternativesByGuid = {};

          customEach(function(entry) {
            if (!alternativesByGuid[entry.url.workflowGuid]) {
              alternativesByGuid[entry.url.workflowGuid] = [];
            }
            alternativesByGuid[entry.url.workflowGuid].push(entry);
          });

          customEach(function(entry) {
            if (self.workflow) {
              entry.url['xhtml:link'] = [
                {
                  _attributes: {
                    rel: 'alternate',
                    hreflang: entry.url.workflowLocale,
                    href: entry.url.loc
                  }
                }
              ];
            }

            const alternatives = alternativesByGuid[entry.url.workflowGuid];

            for (const alternative in alternatives) {
              if (alternative === entry) {
                return;
              }
              entry.url['xhtml:link'].push({
                _attributes: {
                  rel: 'alternate',
                  hreflang: alternative.url.workflowLocale,
                  href: alternative.url.loc
                }
              });
            };
          });

          customEach(function(entry) {
            delete entry.url.workflowLocale;
            delete entry.url.workflowGuid;
          }, true);

          function customEach(iterator, ignoreWorkflow) {
            for (const map in self.maps) {
              self.maps[map].forEach(function(entry) {
                if (typeof (entry) !== 'object') {
                  return;
                }

                // TODO: Update workflowGuid
                if (!entry.url.workflowGuid && !ignoreWorkflow) {
                  return;
                }
                iterator(entry);
              });
            }
          }
        }

        function write() {
          return self.writeSitemap();
        }

        async function unlock() {
          await self.apos.lock.unlock('apos-sitemap');
        }
      },
      writeSitemap: function() {
        if (!self.perLocale) {
          // Simple single-file sitemap
          self.file = self.caching
            ? 'sitemap.xml'
            : (self.apos.argv.file || '/dev/stdout');

          const map = Object.keys(self.maps).map(locale => {
            return self.maps[locale].map(self.stringify).join('\n');
          }).join('\n');

          self.writeMap(self.file, map);
        } else {
          // They should be broken down by host, in which case we automatically
          // place them in public/sitemaps in a certain naming pattern
          self.ensureDir('sitemaps');

          for (const key in self.maps) {
            let map = self.maps[key];
            const extension = (self.format === 'xml') ? 'xml' : 'txt';

            map = map.map(map, self.stringify).join('\n');

            self.writeMap('sitemaps/' + key + '.' + extension, map);

          }

          self.writeIndex();
        }
        if (self.caching) {
          // TODO
          return self.writeToCache();
        }
        return null;
      },
      writeToCache: async function(callback) {
        await self.apos.cache.clear(sitemapCacheName);
        await insert();

        async function insert() {
          for (const doc of self.cacheOutput) {
            await self.apos.cache.set(sitemapCacheName, doc.filename, doc, self.cacheLifetime);
          }
        }

        // TEMP
        return 'success';
      },
      writeIndex: function() {
        const now = new Date();
        if (!self.baseUrl) {
          throw new Error(
            'You must specify the top-level baseUrl option when configuring Apostrophe\n' +
            'to use sitemap indexes. Example: baseUrl: "http://mycompany.com"\n\n' +
            'Note there is NO TRAILING SLASH.\n\n' +
            'Usually you will override this in data/local.js, on production.'
          );
        }

        self.writeFile('sitemaps/index.xml',

          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +

          Object.keys(self.maps).map(function(key) {
            const sitemap = '  <sitemap>\n' +
              '    <loc>' + self.baseUrl + self.apos.prefix + '/sitemaps/' + key + '.xml' +
                '</loc>\n' +
              '    <lastmod>' + now.toISOString() + '</lastmod>\n' +
            '  </sitemap>\n';
            return sitemap;
          }).join('') +
          '</sitemapindex>\n'
        );

      },
      writeMap: function(file, map) {
        if (self.format === 'xml') {
          self.writeXmlMap(file, map);
        } else {
          self.writeFile(file, map);
        }
      },
      writeXmlMap: function(file, map) {
        self.writeFile(file,
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
          ' xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          map +
          '</urlset>\n'
        );
      },
      writeFile: function(filename, str) {
        if (!self.caching) {
          filename = require('path').resolve(self.apos.rootDir + '/public', filename);
          if (filename === '/dev/stdout') {
            // Strange bug on MacOS when using writeFileSync with /dev/stdout
            fs.writeSync(1, str);
          } else {
            fs.writeFileSync(filename, str);
          }
        } else {
          self.cacheOutput.push({
            filename: filename,
            data: str,
            createdAt: new Date()
          });
        }
      },
      async getPages (req) {
        const pages = await self.apos.page.find(req, {}).areas(false)
          .relationships(false).sort({
            level: 1,
            rank: 1
          }).toArray();

        pages.forEach(self.output);
      },
      async getPieces(req) {
        const modules = Object.values(self.apos.modules).filter(function(mod) {
          return mod.__meta.chain.find(entry => {
            return entry.name === '@apostrophecms/piece-type';
          });
        });

        let skip = 0;

        for (const appModule of modules) {
          if (self.excludeTypes.includes(appModule.__meta.name)) {
            continue;
          }
          await stashPieces(appModule);
          skip = 0;
        }

        async function stashPieces(appModule) {
          // Paginate through 100 (by default) at a time to avoid slamming
          // memory
          const pieceSet = await appModule.find(req, {})
            .relationships(false).areas(false).skip(skip)
            .limit(self.piecesPerBatch).toArray();

          pieceSet.forEach(function(piece) {
            if (!piece._url) {
            // This one has no page to be viewed on
              return;
            }
            // Results in a reasonable priority relative
            // to regular pages
            piece.level = 3;
            // Future events are interesting, past events are boring
            if (piece.startDate) {
              if (piece.startDate > self.today) {
                piece.level--;
              } else {
                piece.level++;
              }
            }
            self.output(piece);
          });

          if (pieceSet.length) {
            skip += pieceSet.length;

            await stashPieces(appModule);
          }
        }
      },
      // Output the sitemap entry for the given doc, including its children if
      // any. The entry is buffered for output as part of the map for the
      // appropriate locale. If the workflow module is not in use they all
      // accumulate together for a "default" locale. Content not subject to
      // workflow is grouped with the "default" locale. If workflow is active
      // and the locale is not configured or is marked private, the output is
      // discarded.

      output: async function(page) {
        const locale = page.workflowLocale || defaultLocale;
        if (self.workflow) {
          // TODO: Workflow bits refactor
          // if (!self.workflow.locales[locale]) {
          //   return;
          // }
          // if (self.workflow.locales[locale].private) {
          //   return;
          // }
        }

        if (!self.excludeTypes.includes(page.type)) {
          let url;

          if (self.format === 'text') {
            if (self.indent) {
              let i;

              for (i = 0; (i < page.level); i++) {
                self.write(locale, '  ');
              }

              self.write(locale, page._url + '\n');
            }
          } else {
            url = page._url;
            let priority = (page.level < 10) ? (1.0 - page.level / 10) : 0.1;

            if (typeof (page.siteMapPriority) === 'number') {
              priority = page.siteMapPriority;
            }

            self.write(locale, {
              url: {
                priority: priority,
                changefreq: 'daily',
                loc: url,
                workflowGuid: page.workflowGuid,
                workflowLocale: locale
              }
            });
          }
        }

      },
      // Override to do more. You can invoke `self.output(doc)`
      // from here as many times as you like.
      custom: async function (req, locale) {
        return null;
      },
      // Append `str` to an array set aside for the map entries
      // for the host `locale`.
      write: function(locale, str) {
        self.maps[locale] = self.maps[locale] || [];
        self.maps[locale].push(str);
      },
      sendCache: async function(res, path) {
        try {
          const file = await self.apos.cache.get(sitemapCacheName, path);

          if (!file) {
            // If anything else exists in our little filesystem, this should be
            // a 404 (think of a URL like /sitemap/madeupstuff). Otherwise it
            // just means the cache has expired or has never been populated.
            //
            // Check for the sitemap index or, if we're not running in that
            // mode, check for sitemap.xml
            //
            // Without this check every 404 would cause a lot of work to be
            // done.
            const sitemapFile = self.perLocale ? 'sitemaps/index.xml' : 'sitemap.xml';
            const exists = await self.apos.cache.get(sitemapCacheName, sitemapFile);

            if (exists) {
              return notFound();
            }
            return self.cacheAndRetry(res, path);
          }
          return res.contentType('text/xml').send(file.data);
        } catch (error) {
          return fail(error);
        }

        function notFound() {
          return res.status(404).send('not found');
        }

        function fail(err) {
          console.error(err);
          return res.status(500).send('error');
        }
      },
      cacheAndRetry: async function(res, path) {
        try {
          await self.map();
          return self.sendCache(res, path);
        } catch (error) {
          return fail(error);
        }

        function fail(err) {
          console.error('cacheAndRetry error:', err);
          return res.status(500).send('error');
        }
      },
      stringify (value) {
        if (Array.isArray(value) && (self.format !== 'xml')) {
          return value.join('');
        }
        if (typeof (value) !== 'object') {
          if (self.format === 'xml') {
            return self.apos.util.escapeHtml(value);
          }
          return value;
        }
        let xml = '';
        for (const k in value) {
          const v = value[k];
          if (k === '_attributes') {
            return;
          }
          if (Array.isArray(v)) {
            v.forEach(v, function(el) {
              element(k, el);
            });
          } else {
            element(k, v);
          }
        }

        function element(k, v) {
          xml += '<' + k;
          if (v && v._attributes) {
            for (const a in v._attributes) {
              const av = v._attributes[a];

              xml += ' ' + a + '="' + self.apos.util.escapeHtml(av) + '"';
            }

          }
          xml += '>';
          xml += self.stringify(v || '');
          xml += '</' + k + '>\n';
        }

        return xml;
      },
      ensureDir (dir) {
        if (!self.caching) {
          dir = self.apos.rootDir + '/public/' + dir;
          try {
            fs.mkdirSync(dir);
          } catch (e) {
            // The directory already exists.
          }
        }
      }
      // End of methods obj
    };
  }
};

// function getBundleModuleNames() {
//   const source = path.join(__dirname, './modules/@apostrophecms');
//   return fs
//     .readdirSync(source, { withFileTypes: true })
//     .filter(dirent => dirent.isDirectory())
//     .map(dirent => `@apostrophecms/${dirent.name}`);
// }
