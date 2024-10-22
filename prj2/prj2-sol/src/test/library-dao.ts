//will run the project DAO using an in-memory mongodb server
import { MemDao, makeMemDao } from './mem-dao.js';
import { LendingLibrary, makeLendingLibrary } from '../lib/lending-library.js';
import { LibraryDao, } from '../lib/library-dao.js';

import * as Lib from '../lib/library.js';

import { BOOKS, } from './test-data.js';

import { assert, expect } from 'chai';
import { domainToASCII } from 'url';

describe('library DAO', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDao : MemDao;
  let dao: LibraryDao;
  let library: LendingLibrary;
  
  beforeEach(async function () {
    const daoResult = await makeMemDao();
    assert(daoResult.isOk === true);
    memDao = daoResult.val;
    dao = memDao.dao;
    library = makeLendingLibrary(dao);
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    await memDao.tearDown();
  });

  //TODO: add test suites here as needed to test your DAO as you implement it
  //(your DAO is available as variable "dao").

  //test make() ??
  //test clear()
  it('should clear the database', async () => {
    const book = BOOKS[0];
    const book1 = { ...book };
    await library.addBook(book1);
    const clearResult = await dao.clear();
    assert(clearResult.isOk == true);
    const books = await library.findBooks({});
    //assert(books.length === 0);
  });

  //test close()
  it('should add  book to the database', async () => {
    const book = BOOKS[0];
    const book1 = { ...book };
    await library.addBook(book1);
    const closeResult = await dao.close();
    assert(closeResult.isOk == true);
    const books = await library.findBooks({});
    //assert(books.length === 0);
  });

  
});


const PATRONS = [ 'joe', 'bill', 'sue', 'anne', 'karen' ];
const ISBNS = BOOKS.slice(0, 5).map(b => b.isbn);
//LENDS = ISBNS x PATRONS
const LENDS = ISBNS.reduce((acc, isbn) => 
  acc.concat(PATRONS.map(patronId => ({ isbn, patronId }))), []);