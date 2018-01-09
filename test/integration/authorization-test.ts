import { sinon, expect, fetchMock } from '../test-helper';
import { Config } from '../../src/index';
import { configSetup, ApplicationRecord, Author, Person } from '../fixtures';

after(function () {
  fetchMock.restore();
});

describe('authorization headers', function() {
  describe('when header is set on model class', function() {
    beforeEach(function() {
      ApplicationRecord.jwt = 'myt0k3n';
    });

    afterEach(function() {
      fetchMock.restore();
      ApplicationRecord.jwt = null;
    });

    it('is sent in request', function(done) {
      fetchMock.mock((url, opts) => {
        expect(opts.headers.Authorization).to.eq('Token token="myt0k3n"')
        done();
        return true;
      }, 200);
      Author.find(1);
    });
  });

  describe('when header is set in a custom generateAuthHeader', function() {
    let originalHeaderFn = Person.generateAuthHeader;
    beforeEach(function() {
      ApplicationRecord.jwt = 'cu570m70k3n';
      Person.generateAuthHeader = function(token) {
        return `Bearer ${token}`;
      };
    });

    afterEach(function() {
      fetchMock.restore();
      Person.generateAuthHeader = originalHeaderFn;
    });

    it("sends the custom Authorization token in the request's headers", function(done) {
      fetchMock.mock((url, opts) => {
        expect(opts.headers.Authorization).to.eq('Bearer cu570m70k3n');
        done();
        return true;
      }, 200);
      Person.find(1);
    });
  });

  describe('when header is NOT returned in response', function() {
    beforeEach(function() {
      fetchMock.get('http://example.com/api/v1/authors', {
        data: [
          {
            id: '1',
            type: 'people',
            attributes: {
              name: 'John'
            }
          }
        ]
      });

      ApplicationRecord.jwt = 'dont change me';
    });

    afterEach(function() {
      fetchMock.restore();
      ApplicationRecord.jwt = null;
    });

    it('does not override the JWT', function(done) {
      Author.all().then((response) => {
        expect(ApplicationRecord.jwt).to.eq('dont change me');
        done();
      });
    });
  });

  describe('when header is returned in response', function() {
    beforeEach(function() {
      fetchMock.mock({
        matcher: '*',
        response: {
          status: 200,
          body: { data: [] },
          headers: {
            'X-JWT': 'somet0k3n'
          }
        }
      });
    });

    afterEach(function() {
      fetchMock.restore();
      ApplicationRecord.jwt = null;
    });

    it('is used in subsequent requests', function(done) {
      Author.all().then((response) => {
        fetchMock.restore();

        fetchMock.mock((url, opts) => {
          expect(opts.headers.Authorization).to.eq('Token token="somet0k3n"')
          done();
          return true;
        }, 200);
        expect(Author.getJWT()).to.eq('somet0k3n');
        expect(ApplicationRecord.jwt).to.eq('somet0k3n');
        Author.all();
      });
    });

    describe('local storage', function() {
      beforeEach(function() {
        Config.localStorage = { setItem: sinon.spy() }
        Config.jwtLocalStorage = 'jwt';
      });

      afterEach(function() {
        Config.localStorage = undefined;
        Config.jwtLocalStorage = undefined;
      });

      describe('when configured to store jwt', function() {
        beforeEach(function() {
          Config.jwtLocalStorage = 'jwt';
        });

        it('updates localStorage on server response', function(done) {
          Author.all().then((response) => {
            let called = Config.localStorage.setItem
              .calledWith('jwt', 'somet0k3n');
            expect(called).to.eq(true);
            done();
          });
        });

        it('uses the new jwt in subsequent requests', function(done) {
          Author.all().then((response) => {
            fetchMock.restore();

            fetchMock.mock((url, opts) => {
              expect(opts.headers.Authorization).to.eq('Token token="somet0k3n"')
              done();
              return true;
            }, 200);
            expect(Author.getJWT()).to.eq('somet0k3n');
            expect(ApplicationRecord.jwt).to.eq('somet0k3n');
            Author.all();
          });
        });

        describe('when JWT is already in localStorage', function() {
          beforeEach(function() {
            fetchMock.restore();
            Config.localStorage['getItem'] = sinon.stub().returns('myt0k3n');
            configSetup({ jwtLocalStorage: 'jwt' });
          });

          afterEach(function() {
            configSetup();
          });

          it('sends it in initial request', function(done) {
            fetchMock.mock((url, opts) => {
              expect(opts.headers.Authorization).to.eq('Token token="myt0k3n"')
              done();
              return true;
            }, 200);
            Author.find(1);
          });
        });
      });

      describe('when configured to NOT store jwt', function() {
        beforeEach(function() {
          Config.jwtLocalStorage = false;
        });

        it('is does NOT update localStorage on server response', function(done) {
          Author.all().then((response) => {
            let called = Config.localStorage.setItem.called;
            expect(called).to.eq(false);
            done();
          });
        });
      });
    });
  });

  describe('a write request', function() {
    beforeEach(function() {
      fetchMock.mock({
        matcher: '*',
        response: {
          status: 200,
          body: { data: [] },
          headers: {
            'X-JWT': 'somet0k3n'
          }
        }
      });
    });

    afterEach(function() {
      fetchMock.restore();
      ApplicationRecord.jwt = null;
    });

    it('also refreshes the jwt', function(done) {
      let author = new Author({ firstName: 'foo' });
      author.save().then(() => {
        expect(ApplicationRecord.jwt).to.eq('somet0k3n');
        done();
      });
    });
  });
});
