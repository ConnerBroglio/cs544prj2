import * as mongo from 'mongodb';

import { Errors } from 'cs544-js-utils';

import * as Lib from './library.js';

//TODO: define any DB specific types if necessary

export async function makeLibraryDao(dbUrl: string) {
  return await LibraryDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  ignoreUndefined: true,  //ignore undefined fields in queries
};

type Patron = any
export class LibraryDao {

  //private dbClient: mongo.MongoClient;
  private booksCollection: mongo.Collection<Lib.XBook>;
  private patronsCollection: mongo.Collection<Patron>;
  //called by below static make() factory function with
  //parameters to be cached in this instance.
  /*constructor(dbClient: mongo.MongoClient, booksCollection: mongo.Collection, patronsCollection: mongo.Collection) {
    this.dbClient = dbClient;
    this.booksCollection = booksCollection;
    this.patronsCollection = patronsCollection;
  }*/
  constructor(private readonly client: mongo.MongoClient){
    //constructor(dbClient: mongo.MongoClient, booksCollection: mongo.Collection, patronsCollection: mongo.Collection) {
    const db = this.client.db();
    this.booksCollection = db.collection<Lib.XBook>('books') //booksCollection;
    this.patronsCollection = db.collection<Patron>('patrons');
  }
   
  //static factory function; should do all async operations like
  //getting a connection and creating indexing.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make(dbUrl: string) : Promise<Errors.Result<LibraryDao>> {
    try {
      const client = new mongo.MongoClient(dbUrl, MONGO_OPTIONS);
      await client.connect();  // Open connection to the database
      const db = client.db();  // Use the default database from the URL
      // Create collections (if they don't already exist)
      const booksCollection = db.collection('books');
      const patronsCollection = db.collection<Patron>('patrons'); //new
      // Create necessary indexes
      await booksCollection.createIndex({ title: 'text', authors: 'text' });
      await patronsCollection.createIndex({ id:1}, {unique: true});
      // Return the DAO instance with collections
      return Errors.okResult(new LibraryDao(client)); //, booksCollection, patronsCollection
    } catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  /** close off this DAO; implementing object is invalid after
  *  call to close()
  *
  *  Error Codes:
  *    DB: a database error was encountered.
  */
  async close() : Promise<Errors.Result<void>> {
    try {
      await this.client.close();  // Close the MongoDB client connection
      return Errors.okResult(undefined);
    } catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  //add methods as per your API
  async clear(): Promise<Errors.Result<void>> {
    try {
      await this.booksCollection.deleteMany({});  // Clear all documents in the books collection
      return Errors.okResult(undefined);
    } catch (error) {
      return Errors.errResult(error.message, 'DB');
    }
  }

  public getBooksCollection() {
    return this.booksCollection;
  }
  public getPatronCollection(){
    return this.patronsCollection;
  }
  async addCheckedOutBook(patronId: string, isbn: string): Promise<void> {
    await this.getPatronCollection().updateOne(
    { patronId: patronId },
    { $addToSet: { checkedOutBooks: isbn } } // Add the ISBN to the checkedOutBooks array if it doesn't already exist
    );
  }
  async getCheckedOutBooks(patronId: string): Promise<string[]> {
    // Fetch the checked-out books for the specified patronId
    const patronRecord = await this.getPatronCollection().findOne({ patronId: patronId });
    // If the patron doesn't exist or has no checked-out books, return an empty array
    if (!patronRecord || !patronRecord.checkedOutBooks) {
      return [];
    }
    // Return the array of ISBNs for the checked-out books
    return patronRecord.checkedOutBooks;
  }

} //class LibDao