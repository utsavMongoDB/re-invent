import { NextRequest, NextResponse } from 'next/server';
import { getEmbeddingsTransformer, searchArgs } from '@/utils/mongodb';
import { MongoDBAtlasVectorSearch } from '@langchain/community/vectorstores/mongodb_atlas';
import { MongoClient } from 'mongodb';

export async function GET(req: NextRequest) {
  try {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db("reinvent");
    const collection = db.collection('travel');

    const documents = await collection.find({}).toArray();
    if (documents.length === 0) {
      console.log('No documents found.');
      return NextResponse.json({ message: 'No documents found' }, { status: 404 });
    }

    for (const doc of documents) {
      const description = doc.description;
      if (description) {
        // Create embeddings for the description
        const embeddings = await getEmbeddingsTransformer().embedQuery(description);
        console.log(`Document ID: ${doc._id}, Embeddings created`);

        // Update the document with the new embeddings field
        await collection.updateOne(
          { _id: doc._id },
          { $set: { description_embedding: embeddings } }
        );
      } else {
        console.log(`Document ID: ${doc._id} does not have a description.`);
      }
    }

    await client.close();
    return NextResponse.json({ message: "Processed documents and added embeddings to MongoDB" }, { status: 200 });

  } catch (error) {
    console.error('Error processing request:', error);
    return new NextResponse("An error occurred during processing.", { status: 500 });
  }
}
