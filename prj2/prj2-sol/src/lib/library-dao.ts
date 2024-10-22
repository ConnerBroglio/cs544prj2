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


export class LibraryDao {

  private dbClient: mongo.MongoClient;
  private booksCollection: mongo.Collection;
 private patronsCollection: mongo.Collection;
  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(dbClient: mongo.MongoClient, booksCollection: mongo.Collection, patronsCollection: mongo.Collection) {
    this.dbClient = dbClient;
    this.booksCollection = booksCollection;
    this.patronsCollection = patronsCollection;
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
      const patronsCollection = db.collection('patrons');
 
 
      // Create necessary indexes
      await booksCollection.createIndex({ title: 'text', authors: 'text' });
 
 
      // Return the DAO instance with collections
      return Errors.okResult(new LibraryDao(client, booksCollection, patronsCollection));
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
      await this.dbClient.close();  // Close the MongoDB client connection
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
 

} //class LibDao


