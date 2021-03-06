import { expect, sinon } from '../test-helper';
import Scope from '../../src/scope';

let scope;

beforeEach(function() {
  let model = sinon.stub();
  scope = new Scope(model);
});

describe('Scope', function() {
  describe('#page()', function() {
    it('sets correct pagination information', function() {
      scope = scope.page(2);
      expect(scope._pagination).to.eql({ number: 2 });
    });

    it('returns the scope', function() {
      expect(scope.page(2)).to.be.instanceof(Scope)
    });
  });

  describe('#per()', function() {
    it('sets correct pagination information', function() {
      scope = scope.per(10);
      expect(scope._pagination).to.eql({ size: 10 });
    });

    it('returns the scope', function() {
      expect(scope.per(10)).to.be.instanceof(Scope)
    });
  });

  describe('#where()', function() {
    it('updates filter criteria', function() {
      scope = scope.where({ foo: 'bar' })
         .where({ bar: 'baz' })
         .where({ foo: 'bar2' })
      expect(scope._filter).to.eql({
        foo: 'bar2',
        bar: 'baz'
      });
    });

    it('returns the scope', function() {
      expect(scope.where({ foo: 'bar' })).to.be.instanceof(Scope)
    });
  });

  describe('#stats()', function() {
    it('updates stats request', function() {
      scope = scope.stats({ total: 'count' })
        .stats({ average: 'cost' });

      expect(scope._stats).to.eql({
        total: 'count',
        average: 'cost'
      });
    });

    it('returns the scope', function() {
      expect(scope.stats({ total: 'count' })).to.be.instanceof(Scope)
    });
  });

  describe('#order()', function() {
    it('updates sort criteria', function() {
      scope = scope.order('foo')
        .order({ bar: 'desc' });
      expect(scope._sort).to.eql({
        foo: 'asc',
        bar: 'desc'
      });
    });

    it('returns the scope', function() {
      expect(scope.order('foo')).to.be.instanceof(Scope)
    });
  });

  describe('#select()', function() {
    it('updates fields criteria', function() {
      scope = scope.select({ people: ['foo', 'bar'] })
        .select({ things: ['baz'] })
      expect(scope._fields).to.eql({
        people: ['foo', 'bar'],
        things: ['baz']
      });
    });

    it('returns the scope', function() {
      expect(scope.select({ people: ['foo'] })).to.be.instanceof(Scope)
    });
  });

  describe('#includes()', function() {
    describe('when passed a string', function() {
      it('updates include criteria', function() {
        scope = scope.includes('foo')
        expect(scope._include).to.eql({
          foo: {}
        });
      });
    });

    describe('when passed an array', function() {
      it('updates include criteria', function() {
        scope = scope.includes(['foo', 'bar']);
        expect(scope._include).to.eql({
          foo: {},
          bar: {}
        });
      });
    });

    describe('when passed a nested object', function() {
      it('updates include criteria', function() {
        scope = scope.includes({ a: ['b', { c: 'd' }] });
        expect(scope._include).to.eql({
          a: {
            b: {},
            c: {
              d: {}
            }
          }
        });
      });
    });

    it('returns the scope', function() {
      expect(scope.includes('foo')).to.be.instanceof(Scope)
    });
  });

  describe('#scope()', function() {
    it('returns itself', function() {
      expect(scope.scope()).to.equal(scope)
    })
  })

  describe('#asQueryParams()', function() {
    it('transforms all scoping criteria into a jsonapi-compatible query param object', function() {
      scope = scope
        .page(2)
        .per(10)
        .where({ foo: 'bar' })
        .where({ bar: 'baz' })
        .order('foo')
        .order({ bar: 'desc' })
        .select({ people: ['name', 'age'] })
        .select({ pets: ['type'] })
        .selectExtra({ people: ['net_worth'] })
        .stats({ total: 'count' })
        .includes({ a: ['b', { c: 'd' }] })
      let qp = scope.asQueryParams();

      expect(qp).to.eql({
        page: {
          size: 10,
          number: 2
        },
        filter: {
          bar: 'baz',
          foo: 'bar'
        },
        sort: ['foo', '-bar'],
        fields: {
          people: ['name', 'age'],
          pets: ['type']
        },
        extra_fields: {
          people: ['net_worth']
        },
        stats: {
          total: 'count'
        },
        include: 'a.b,a.c.d'
      });
    });
  });

  describe('#toQueryParams', function() {
    it('transforms nested query parameter object to query string', function() {
      scope = scope
        .page(2)
        .per(10)
        .where({ foo: 'bar' })
        .order('foo')
        .order({ bar: 'desc' })
        .select({ people: ['name', 'age'] })
        .stats({ total: 'count' })
        .includes({ a: ['b', { c: 'd' }] })
      expect(scope.toQueryParams()).to.eq('page[number]=2&page[size]=10&filter[foo]=bar&sort=foo,-bar&fields[people]=name,age&stats[total]=count&include=a.b,a.c.d');
    });

    it('does not include empty objects', function() {
      scope = scope.page(2);
      expect(scope.toQueryParams().match(/field/) === null).to.eq(true);
    });

    describe('when no scoping criteria present', function() {
      it('returns undefined', function() {
        expect(scope.toQueryParams()).to.eq(undefined);
      })
    });
  });

  describe('#copy', function() {
    it('should make a copy of the scope', function() {
      expect(scope.copy()).not.to.eq(scope)
    })

    it('should make a copy of scope attributes', function() {
      let original = scope.order({foo: 'asc'}).page(1).per(20)

      let copy = original.copy()

      expect(original._pagination).not.to.eq(copy._pagination)
      expect(original._pagination).to.deep.eq(copy._pagination)

      expect(original._sort).not.to.eq(copy._sort)
      expect(original._sort).to.deep.eq(copy._sort)
    })
  })
});
