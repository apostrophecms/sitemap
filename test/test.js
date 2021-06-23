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
    await t.create({
      root: module,
      baseUrl: 'http://localhost:7780',
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 7780,
            session: { secret: 'supersecret' }
          }
        },
        '@apostrophecms/sitemap': {},
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
        },
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
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-two</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/tab-one/child-one</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/cheese</loc>') !== -1);
      assert(xml.indexOf('<loc>http://localhost:7780/products/rocks</loc>') === -1);
    } catch (error) {
      assert(!error);
    }
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
