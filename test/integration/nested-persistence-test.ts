import { sinon, expect, fetchMock } from '../test-helper';
import { Author, Book, Genre } from '../fixtures';
import tempId from '../../src/util/temp-id';

let fetchMock = require('fetch-mock');

let instance;
let payloads;
let putPayloads;
let deletePayloads;
let serverResponse;

const resetMocks = function() {
  fetchMock.restore();

  fetchMock.post('http://example.com/api/v1/authors', function(url, payload) {
    payloads.push(JSON.parse(payload.body));
    return serverResponse;
  });

  fetchMock.put('http://example.com/api/v1/authors/1', function(url, payload) {
    putPayloads.push(JSON.parse(payload.body));
    return serverResponse;
  });

  fetchMock.delete('http://example.com/api/v1/authors/1', function(url, payload) {
    deletePayloads.push({});
    return serverResponse;
  });
}

let expectedCreatePayload =  {
  data: {
    type: 'authors',
    attributes: { first_name: 'Stephen' },
    relationships: {
      books: {
        data: [
          {
            ['temp-id']: 'abc1',
            type: 'books',
            method: 'create'
          }
        ]
      },
      special_books: {
        data: [
          {
            ['temp-id']: 'abc3',
            type: 'books',
            method: 'create'
          }
        ]
      }
    }
  },
  included: [
    {
      ['temp-id']: 'abc1',
      type: 'books',
      attributes: {
        title: 'The Shining'
      },
      relationships: {
        genre: {
          data: {
            ['temp-id']: 'abc2',
            type: 'genres',
            method: 'create'
          }
        }
      }
    },
    {
      ['temp-id']: 'abc2',
      type: 'genres',
      attributes: {
        name: 'Horror'
      }
    },
    {
      ['temp-id']: 'abc3',
      type: 'books',
      attributes: {
        title: 'The Stand'
      }
    }
  ]
};

let expectedUpdatePayload = function(method) {
  return {
    data: {
      id: '1',
      type: 'authors',
      relationships: {
        books: {
          data: [
            {
              id: '10',
              type: 'books',
              method: method
            }
          ]
        }
      }
    },
    included: [
      {
        id: '10',
        type: 'books',
        attributes: {
          title: 'Updated Book Title'
        },
        relationships: {
          genre: {
            data: {
              id: '20',
              type: 'genres',
              method: method
            }
          }
        }
      },
      {
        id: '20',
        type: 'genres',
        attributes: {
          name: 'Updated Genre Name'
        }
      }
    ]
  }
};

const seedPersistedData = function() {
  let genre = new Genre({ id: '20', name: 'Horror' });
  genre.isPersisted(true);
  let book = new Book({ id: '10', title: 'The Shining', genre: genre });
  book.isPersisted(true);
  let specialBook = new Book({ id: '30', title: 'The Stand' });
  specialBook.isPersisted(true);
  instance.id = '1';
  instance.books = [book];
  instance.specialBooks = [specialBook];
  instance.isPersisted(true);
  genre.name = 'Updated Genre Name';
  book.title = 'Updated Book Title';
}

describe('nested persistence', function() {
  beforeEach(function() {
    payloads = [];
    putPayloads = [];
    deletePayloads = [];
    instance = new Author({ firstName: 'Stephen' });
    serverResponse = {
      data: {
        id: '1',
        type: 'authors',
        attributes: { first_name: 'first name from server' },
        relationships: {
          books: {
            data: [{
              id: '10',
              type: 'books'
            }]
          }
        }
      },
      included: [
        {
          ['temp-id']: 'abc1',
          id: '10',
          type: 'books',
          attributes: { title: 'title from server' },
          relationships: {
            genre: {
              data: {
                id: '20',
                type: 'genres'
              }
            }
          }
        },
        {
          ['temp-id']: 'abc2',
          id: '20',
          type: 'genres',
          attributes: { name: 'name from server' }
        },
        {
          ['temp-id']: 'abc3',
          id: '30',
          type: 'books',
          attributes: { title: 'another title from server' }
        }
      ]
    }
  });

  afterEach(function () {
    fetchMock.restore();
  });

  beforeEach(function () {
    resetMocks();
  });

  let tempIdIndex = 0;
  beforeEach(function() {
    sinon.stub(tempId, 'generate').callsFake(function() {
      tempIdIndex++
      return `abc${tempIdIndex}`;
    });
  });

  afterEach(function() {
    tempIdIndex = 0;
    tempId.generate['restore']();
  });

  describe('basic nested create', function() {
    beforeEach(function() {
      let genre = new Genre({ name: 'Horror' });
      let book = new Book({ title: 'The Shining', genre: genre });
      let specialBook = new Book({ title: 'The Stand' });
      instance.books = [book];
      instance.specialBooks = [specialBook];
    });

    // todo test on the way back - id set, attrs updated, isPersisted
    // todo remove #destroy? and just save when markwithpersisted? combo? for ombined payload
    // todo test unique includes/circular relationshio
    it('sends the correct payload', function(done) {
      instance.save({ with: { books: 'genre', specialBooks: {} } }).then((response) => {
        expect(payloads[0]).to.deep.equal(expectedCreatePayload);
        done();
      });
    });

    it('assigns ids from the response', function(done) {
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(instance.id).to.eq('1');
        expect(instance.books[0].id).to.eq('10');
        expect(instance.books[0].genre.id).to.eq('20');
        done();
      });
    });

    xit('removes old temp ids', function(done) {
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(instance.id).to.eq('1');
        expect(instance.books[0].temp_id).to.eq(null);
        expect(instance.books[0].genre.temp_id).to.eq(null);
        done();
      });
    });

    it('updates attributes with data from server', function(done) {
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(instance.firstName).to.eq('first name from server');
        expect(instance.books[0].title).to.eq('title from server');
        expect(instance.books[0].genre.name).to.eq('name from server');
        done();
      });
    });

    describe('when a hasMany relationship has no dirty members', function() {
      beforeEach(function() {
        instance.books[0] = new Book();
      });

      it('should not be sent in the payload', function(done) {
        instance.save({ with: { books: 'genre' } }).then((response) => {
          expect(payloads[0]['data']['relationships']).to.eq(undefined)
          done();
        });
      });
    });
  });

  describe('basic nested update', function() {
    let expected;

    beforeEach(function() {
      seedPersistedData();
    });

    it('sends the correct payload', function(done) {
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(putPayloads[0]).to.deep.equal(expectedUpdatePayload('update'));
        done();
      });
    });
  });

  describe('basic nested destroy', function() {
    beforeEach(function() {
      seedPersistedData();
    });

    it('sends the correct payload', function(done) {
      instance.books[0].isMarkedForDestruction(true);
      instance.books[0].genre.isMarkedForDestruction(true);
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(putPayloads[0]).to.deep.equal(expectedUpdatePayload('destroy'));
        done();
      });
    });

    it('removes the associated has_many data', function(done) {
      instance.books[0].isMarkedForDestruction(true);
      instance.save({ with: 'books' }).then((response) => {
        expect(instance.books.length).to.eq(0);
        done();
      });
    });

    it('removes the associated belongs_to data', function(done) {
      instance.books[0].genre.isMarkedForDestruction(true);
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(instance.books[0].genre).to.eq(null);
        done();
      });
    });
  });

  describe('basic nested disassociate', function() {
    beforeEach(function() {
      seedPersistedData();
    });

    it('sends the correct payload', function(done) {
      instance.books[0].isMarkedForDisassociation(true);
      instance.books[0].genre.isMarkedForDisassociation(true);
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(putPayloads[0]).to.deep.equal(expectedUpdatePayload('disassociate'));
        done();
      });
    });

    it('removes the associated has_many data', function(done) {
      instance.books[0].isMarkedForDisassociation(true);
      instance.save({ with: 'books' }).then((response) => {
        expect(instance.books.length).to.eq(0);
        done();
      });
    });

    it('removes the associated belongs_to data', function(done) {
      instance.books[0].genre.isMarkedForDisassociation(true);
      instance.save({ with: { books: 'genre' } }).then((response) => {
        expect(instance.books[0].genre).to.eq(null);
        done();
      });
    });
  });
});
