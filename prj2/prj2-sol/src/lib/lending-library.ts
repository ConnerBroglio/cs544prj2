import { Errors } from 'cs544-js-utils';

import { LibraryDao } from './library-dao.js';
import * as Lib from './library.js';

/** Note that errors are documented using the `code` option which must be
 *  returned (the `message` can be any suitable string which describes
 *  the error as specifically as possible).  Whenever possible, the
 *  error should also contain a `widget` option specifying the widget
 *  responsible for the error).
 *
 *  Note also that the underlying DAO should not normally require a
 *  sequential scan over all books or patrons.
 */


/************************ Main Implementation **************************/

export function makeLendingLibrary(dao: LibraryDao) {
  return new LendingLibrary(dao);
}

export class LendingLibrary {

  constructor(private readonly dao: LibraryDao) {
  }

  /** clear out underlying db */
  async clear() : Promise<Errors.Result<void>> {
    return await this.dao.clear();
  }

  /** Add one-or-more copies of book represented by req to this library.
   *  If the book is already in the library and consistent with the book
   *  being added, then the nCopies of the book is simply updated by
   *  the nCopies of the object being added (default 1).
   *
   *  Errors:
   *    MISSING: one-or-more of the required fields is missing.
   *    BAD_TYPE: one-or-more fields have the incorrect type.
   *    BAD_REQ: other issues, like:
   *      "nCopies" or "pages" not a positive integer.
   *      "year" is not integer in range [1448, currentYear]
   *      "isbn" is not in ISBN-10 format of the form ddd-ddd-ddd-d
   *      "title" or "publisher" field is empty.
   *      "authors" array is empty or contains an empty author
   *      book is already in library but data in req is 
   *      inconsistent with the data already present.
   */
  async addBook(req: Record<string, any>): Promise<Errors.Result<Lib.XBook>> {
    const bookResult = Lib.validate<Lib.Book>('addBook', req);
    if (!bookResult.isOk) {
      return bookResult;
    }
    const newBook = bookResult.val;
    const existingBookResult = await this.dao.getBooksCollection().findOne({ isbn: newBook.isbn });
    const existingBook = existingBookResult as Lib.Book;
    if (existingBook) {
      const conflictField = compareBook(existingBook, newBook);
      if (conflictField) {
        return Errors.errResult(`Book conflict in field: ${conflictField}`, 'BAD_REQ');
      }
      await this.dao.getBooksCollection().updateOne( { isbn: newBook.isbn }, { $inc: { nCopies: newBook.nCopies || 1 } });
      return Errors.okResult(existingBook);
    } else {
      await this.dao.getBooksCollection().insertOne(newBook);
      return Errors.okResult(newBook);
    }
  } 

  /** Return all books whose authors and title fields contain all
   *  "words" in req.search, where a "word" is a max sequence of /\w/
   *  of length > 1.  Note that word matching must be case-insensitive,
   *  but can depend on any stemming rules of the underlying database.
   *  
   *  The req can optionally contain non-negative integer fields
   *  index (default 0) and count (default DEFAULT_COUNT).  The
   *  returned results are a slice of the sorted results from
   *  [index, index + count).  Note that this slicing *must* be
   *  performed by the database.
   *
   *  Returned books should be sorted in ascending order by title.
   *  If no books match the search criteria, then [] should be returned.
   *
   *  Errors:
   *    MISSING: search field is missing
   *    BAD_TYPE: search field is not a string or index/count are not numbers.
   *    BAD_REQ: no words in search, index/count not int or negative.
   */
  async findBooks(req: Record<string, any>): Promise<Errors.Result<Lib.XBook[]>> {
    if (!req.search) {
      return Errors.errResult('Search field is missing', 'MISSING', 'search');
    }
    if (typeof req.search !== 'string') {
      return Errors.errResult('Search field is not a string', 'BAD_TYPE', 'search');
    }
    const searchWords = extractWords(req.search);
    if (searchWords.length === 0) {
      return Errors.errResult('No valid words in search', 'BAD_REQ', 'search');
    }
 
    const searchQuery = searchWords.map(word => `"${word}"`).join(' ');
    const index = req.index !== undefined ? parseInt(req.index, 10) : 0;
    const count = req.count !== undefined ? parseInt(req.count, 10) : DEFAULT_COUNT;
    if(isNaN(index) || index < 0) {
      return Errors.errResult('Invalid index value', 'BAD_TYPE', 'index');
    }
    if(isNaN(count) || count <= 0) {
      return Errors.errResult('Invalid count value', 'BAD_TYPE', 'count');
    }
 
    try {
      const results = await this.dao.getBooksCollection()
      .find({ $text: { $search: searchQuery }}, { projection: { _id: 0 } })
      .sort({ title: 1 })
      .toArray() as Lib.Book[];
 
      const paginatedResults = results.slice(index, index + count);
      return Errors.okResult(paginatedResults);
    } catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  } 

  /** Set up patron req.patronId to check out book req.isbn. 
   * 
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ: invalid isbn or error on business rule violation, like:
   *      isbn does not specify a book in the library
   *      no copies of the book are available for checkout
   *      patron already has a copy of the same book checked out
   */
  async checkoutBook(req: Record<string, any>) : Promise<Errors.Result<void>> {
    if(typeof req.patronId === 'undefined' || req.patronId === null){return Errors.errResult('Missing patronId', 'MISSING', 'patronId');}
     if(typeof req.isbn === 'undefined' || req.isbn === null) {return Errors.errResult('Missing isbn', 'MISSING', 'isbn');}
     if(typeof req.patronId !== 'string'){return Errors.errResult('patronId is not a string', 'BAD_TYPE', 'patronId');}
     if(typeof req.isbn !== 'string'){return Errors.errResult('isbn is not a string', 'BAD_TYPE', 'isbn');}


     const bookResult = await this.dao.getBooksCollection().findOne({ isbn: req.isbn });
     const book = bookResult as Lib.Book;


     if(!book){
       return Errors.errResult('Book not found. Bad book.', 'BAD_REQ', 'isbn');
     }


     if(book.nCopies <= 0){
       return Errors.errResult('No copies are available for checkout', 'BAD_REQ', 'isbn');
      }
    
     //check if already checked out
     const checkedOutBooks = await this.dao.getCheckedOutBooks(req.patronId) || [];
     if(checkedOutBooks.includes(req.patronId)) {
         return Errors.errResult('This book has already been checked out by the patron', 'BAD_REQ', 'isbn');
     }


     //check out book
     await this.dao.getBooksCollection().updateOne(
       { isbn: req.isbn },
       { $inc: { nCopies: -1 } }  //decrease the number of available copies
     );
     //update patron collection
     //await this.dao.getPatronCollection().insertOne(bookToCheckout);
     await this.dao.addCheckedOutBook(req.patronId, req.isbn);
     return Errors.okResult<void>(undefined); //successful return
  }

  /** Set up patron req.patronId to returns book req.isbn.
   *  
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ: invalid isbn or error on business rule violation like
   *    isbn does not specify a book in the library or there is
   *    no checkout of the book by patronId.
   */
  async returnBook(req: Record<string, any>) : Promise<Errors.Result<void>> {
    return Errors.errResult('TODO');
  }

  //add class code as needed

}

// default count for find requests
const DEFAULT_COUNT = 5;

//add file level code as needed
  

/********************** Domain Utility Functions ***********************/

/** return a field where book0 and book1 differ; return undefined if
 *  there is no such field.
 */
function compareBook(book0: Lib.Book, book1: Lib.Book) : string|undefined {
  if (book0.title !== book1.title) return 'title';
  if (book0.authors.some((a, i) => a !== book1.authors[i])) return 'authors';
  if (book0.pages !== book1.pages) return 'pages';
  if (book0.year !== book1.year) return 'year';
  if (book0.publisher !== book1.publisher) return 'publisher';
}

function extractWords(text: string): string[] {
  return text.toLowerCase().match(/\w{2,}/g) || [];
}
