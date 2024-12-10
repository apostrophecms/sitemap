const assert = require('assert');
const t = require('apostrophe/test-lib/util');

describe('Apostrophe Sitemap', function() {
  let apos;
  let testDraftProduct;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    const appConfig = getAppConfig();

    await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: {
        ...appConfig,
        testRunner: {
          handlers(self) {
            return {
              'apostrophe:afterInit': {
                checkSitemap () {
                  apos = self.apos;
                  assert(self.apos.modules['@apostrophecms/sitemap']);
                }
              }
            };
          }
        }
      }
    });
  });

  it('insert a product for test purposes', async function() {
    testDraftProduct = apos.product.newInstance();
    testDraftProduct.title = 'Cheese';
    testDraftProduct.slug = 'cheese';

    const inserted = await apos.product.insert(apos.task.getReq(), testDraftProduct);

    assert(inserted._id);
    assert(inserted.slug === 'cheese');
  });

  it('insert an unpublished product for test purposes', async function() {
    const rockProduct = apos.product.newInstance();
    rockProduct.title = 'Rocks';
    rockProduct.slug = 'rocks';
    rockProduct.published = false;

    const inserted = await apos.product.insert(apos.task.getReq({
      mode: 'draft'
    }), rockProduct);

    assert(inserted.aposMode === 'draft');
    assert(inserted.published === false);
    assert(inserted.slug === 'rocks');
  });

  it('should generate a suitable sitemap', async function() {
    try {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-two" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') !== -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
      assert(xml.indexOf('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/rocks" />') === -1);
    } catch (error) {
      assert(!error);
    }
  });

  it('should destroy the app', async function () {
    return t.destroy(apos);
  });

  it('should be a property of the 🆕 apos object that excludes products', async function() {
    const appConfig = getAppConfig({
      excludeTypes: [ 'product-page', 'product' ]
    });

    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: {
        ...appConfig,
        testRunner: {
          handlers(self) {
            return {
              'apostrophe:afterInit': {
                checkSitemap () {
                  apos = self.apos;
                  assert(self.apos.modules['@apostrophecms/sitemap']);
                }
              }
            };
          }
        }
      }
    });
  });

  it('insert 🧀 again', async function() {
    testDraftProduct = apos.product.newInstance();
    testDraftProduct.title = 'Cheese';
    testDraftProduct.slug = 'cheese';

    const inserted = await apos.product.insert(apos.task.getReq(), testDraftProduct);

    assert(inserted._id);
    assert(inserted.slug === 'cheese');
  });

  it('should generate a sitemap without products or product pages', async function() {
    try {
      const xml = await apos.http.get('/sitemap.xml');

      assert(xml);
      assert(xml.indexOf('<loc>http://localhost:7780/</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);

      assert(xml.indexOf('<loc>http://localhost:7780/products</loc>') === -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') === -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
    } catch (error) {
      assert(!error);
    }
  });

  it('should create new multi-language app', async function () {
    await t.destroy(apos);

    const appConfig = getAppConfig({
      multilanguage: true
    });
    apos = await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      testModule: true,
      modules: appConfig
    });

    assert.deepEqual(Object.keys(apos.i18n.getLocales()), [ 'en', 'es', 'fr' ]);

    {
      const rockProduct = apos.product.newInstance();
      rockProduct.title = 'Rocks';
      rockProduct.slug = 'rocks';
      rockProduct.published = false;

      const inserted = await apos.product.insert(apos.task.getReq({
        mode: 'draft'
      }), rockProduct);

      assert(inserted.aposMode === 'draft');
      assert(inserted.published === false);
      assert(inserted.slug === 'rocks');
    }

    {
      const cheeseProduct = apos.product.newInstance();
      cheeseProduct.title = 'Cheese';
      cheeseProduct.slug = 'cheese';

      const inserted = await apos.product.insert(apos.task.getReq(), cheeseProduct);
      await apos.product.publish(apos.task.getReq(), inserted);
      const localized = await apos.product.localize(apos.task.getReq(), inserted, 'es');
      await apos.product.publish(apos.task.getReq(), localized);

      assert(inserted._id);
      assert(inserted.slug === 'cheese');
    }
  });

  it('should generate a multi-language sitemap', async function () {
    const xml = await apos.http.get('/sitemap.xml');

    assert(xml);
    // Home
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/" />\n'
      ) !== -1
    );
    // Child One
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/tab-one/child-one</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/tab-one/child-one" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/tab-one/child-one" />\n'
      ) !== -1
    );
    // Product Cheese
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/products/cheese</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese" />'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://localhost:7780/es/products/cheese</loc>\n' +
        '<xhtml:link rel="alternate" hreflang="es" href="http://localhost:7780/es/products/cheese" />\n' +
        '<xhtml:link rel="alternate" hreflang="en" href="http://localhost:7780/products/cheese" />\n'
      ) !== -1
    );
    assert(
      xml.indexOf(
        '<loc>http://fr.example.com/products/cheese</loc>'
      ) === -1
    );
    assert(
      xml.indexOf(
        '<xhtml:link rel="alternate" hreflang="fr" href="http://fr.example.com/products/cheese" />'
      ) === -1
    );
  });
});

const parkedPages = [
  {
    title: 'Tab One',
    type: 'default-page',
    slug: '/tab-one',
    parkedId: 'tabOne',
    _children: [
      {
        title: 'Tab One Child One',
        type: 'default-page',
        slug: '/tab-one/child-one',
        parkedId: 'tabOneChildOne'
      },
      {
        title: 'Tab One Child Two',
        type: 'default-page',
        slug: '/tab-one/child-two',
        parkedId: 'tabOneChildTwo'
      }
    ]
  },
  {
    title: 'Tab Two',
    type: 'default-page',
    slug: '/tab-two',
    parkedId: 'tabTwo',
    _children: [
      {
        title: 'Tab Two Child One',
        type: 'default-page',
        slug: '/tab-two/child-one',
        parkedId: 'tabTwoChildOne'
      },
      {
        title: 'Tab Two Child Two',
        type: 'default-page',
        slug: '/tab-two/child-two',
        parkedId: 'tabTwoChildTwo'
      }
    ]
  },
  {
    title: 'Products',
    type: 'product-page',
    slug: '/products',
    parkedId: 'products'
  }
];

const pageTypes = [
  {
    name: '@apostrophecms/home-page',
    label: 'Home'
  },
  {
    name: 'default-page',
    label: 'Default'
  },
  {
    name: 'product-page',
    label: 'Products'
  }
];

function getAppConfig (options = {}) {
  return {
    '@apostrophecms/express': {
      options: {
        port: 7780,
        session: { secret: 'supersecret' }
      }
    },
    ...(options.multilanguage
      ? {
        '@apostrophecms/i18n': {
          options: {
            defaultLocale: 'en',
            locales: {
              en: {
                label: 'English'
              },
              es: {
                label: 'Español',
                prefix: '/es'
              },
              fr: {
                label: 'Français',
                hostname: 'fr.example.com'
              }
            }
          }
        }
      }
      : {}
    ),
    '@apostrophecms/sitemap': {
      options: {
        excludeTypes: options.excludeTypes
      }
    },
    '@apostrophecms/page': {
      options: {
        park: parkedPages,
        types: pageTypes
      }
    },
    'default-page': {
      extend: '@apostrophecms/page-type'
    },
    product: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'product'
      }
    },
    'product-page': {
      extend: '@apostrophecms/piece-page-type'
    }
  };
}
