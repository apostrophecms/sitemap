[![CircleCI](https://circleci.com/gh/apostrophecms/sitemap/tree/main.svg?style=svg)](https://circleci.com/gh/apostrophecms/sitemap/tree/main)
[![Chat on Discord](https://img.shields.io/discord/517772094482677790.svg)](https://chat.apostrophecms.org)

# Sitemap generator for Apostrophe 3

The Apostrophe Sitemap module generates XML sitemaps for websites powered by [ApostropheCMS](https://apostrophecms.com). The sitemap includes all of the pages on your site that are visible to the public, including "piece" content, such as events and blog posts.

A frequently updated and accurate XML sitemap allows search engines to index your content more quickly and spot new pages. The Sitemap module will maintain a cached sitemap to load quickly, but then automatically refresh after one hour (by default). This also prevents the sitemap from getting out-of-date, which would be *very bad* for SEO.

## Roadmap

| Feature | Status |
| --- | --- |
| Sitemap generation for single-locale websites | ✅ Implemented |
| Module configuration to exclude certain doc types | ✅ Implemented |
| Tasks to manually generate sitemap | ✅ Implemented |
| Text-style sitemap generation (for content strategy work) | 🚧 Planned |
| Support for multiple locales (localization) | 🚧 Planned |
| Output customization function | 🚧 Planned |

## Installation

```bash
npm install @apostrophecms/sitemap
```

## Use

### Initialization

Configure `@apostrophecms/sitemap` in `app.js` as a project module.

```javascript
// app.js
require('apostrophe')({
  shortName: 'my-project',
  baseUrl: 'https://example.com',
  modules: {
    '@apostrophecms/sitemap': {}
  }
});
```

**Start the site** (with `node app` or your preferred command) and visit `http://localhost:3000/sitemap.xml` (in local development). You should now see any pages displayed in a sitemap as well as any pieces that have an associated piece page.

### Setting the `baseUrl`

It is important to configure a `baseUrl` for the project to properly display URLs. That can be done in the application configuration object as shown above. To support different domains in production and development environments, it can also be configured in a `data/local.js` file which should be ignored by version control. `data/local.js` will take precedence over `app.js`, so both can be used to support multiple environments as well.

```javascript
// data/local.js
module.exports = {
  baseUrl: 'http://localhost:3000'
});
```

You can also add baseUrl in the configuration of the sitemap module. You may not like to modify or overwrite the `baseUrl` for the site or prefer to not use a `baseUrl` for other purposes.

```javascript
// app.js
require('apostrophe')({
  shortName: 'my-project',
  modules: {
    '@apostrophecms/sitemap': {
      baseUrl: 'https://example.com'
    }
  }
});
```

### Options

All sitemap module options are configured in an `options` object.

```javascript
// modules/@apostrophecms/sitemap/index.js
module.exports = {
  // 👇 Module options
  options: {
    cacheLifetime: 1800,
    excludeTypes: [ 'exclusive-page', 'category' ]
    piecesPerBatch: 500
  }
};
```

These can be added in the `app.js` configuration object for the module, but it is better practice use a dedicated file for module configuration.

#### `cacheLifetime`

By default sitemaps are cached for one hour. You can change this by specifying the `cacheLifetime` option to this module, in seconds.

**Tip:** To make entering the cache lifetime easier it can help to write it as a math expression, multiplying the desired number of minutes by sixty:

```javascript
cacheLifetime: 30 * 60 // or 1800 seconds
```

Keep in mind: Google and other search engines more than weekly, if that.Refreshing once every hour is usually more than often enough.

#### `excludeTypes`

If there are particular page types or piece content types that should *not* be in the sitemap, list them in an array as the `excludeType` option.

```javascript
excludeTypes: [ 'exclusive-page', 'category' ]
```

#### `piecesPerBatch`

If you have thousands of URLs to index, building the sitemap may take a long time. By default, this module processes 100 pieces at a time, to avoid using too much memory. You can adjust this by setting the `piecesPerBatch` option to a larger number. Be aware that if you have many fields and content relationships **it is possible this can use a great deal of memory**.

```javascript
piecesPerBatch: 500
```

### Tasks

#### `map`

The `map` command with generate an up-to-date sitemap on demand. The base command **prints the sitemap into the console**, or allows you to pipe it as needed, to help generate a static file version.On the command line, run:

```bash
node app @apostrophecms/sitemap:map
```

Use the `--update-cache` option to force a cache update at any time. The map will not print to the console with this option. If the website is very large (multiple hundreds of URLs), running this task option with a cron job on the production server more often than the standard cache refresh can help ensure the cache is available when a search engine begins crawling the site.

```bash
node app @apostrophecms/sitemap:map --update-cache
```

#### `clear`

You can manually clear the cached sitemap at any time with the `clear` task. This will force a new sitemap to be generated on the next request to `/sitemap.xml`. On the command line, run:

```bash
node app @apostrophecms/sitemap:clear
```

### Telling search engines about the sitemap

Create a `public/robots.txt` file if you do not already have one and add a sitemap line. Here is a valid example for a site that doesn't have any other `robots.txt` rules:

```
Sitemap: https://example.com/sitemap.xml
```

### Troubleshooting

- If you already have a static `public/sitemap.xml` file, **that file will be shown at the `/sitemap.xml` URL path instead.** Remove it to let the module take over.
- Sitemaps are cached for one hour by default, so you won't see content changes instantly. See above about the `cacheLifetime` option, `clear` task, and `map --update-cache` task for ways to refresh the sitemap more frequently.
