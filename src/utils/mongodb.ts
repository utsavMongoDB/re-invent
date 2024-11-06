import { OpenAIEmbeddings } from '@langchain/openai';
import { MongoDBAtlasVectorSearch, MongoDBAtlasVectorSearchLibArgs } from '@langchain/community/vectorstores/mongodb_atlas';
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import { BedrockEmbeddings } from "@langchain/aws";

dotenv.config();

let embeddingsInstance: BedrockEmbeddings | null = null;

const client = new MongoClient(process.env.MONGODB_URI!);
const namespace = "chatter.training_data";
const [dbName, collectionName] = namespace.split(".");
// const dbName = process.env.DB_NAME!;
// const collectionName = process.env.COLL_NAME!;
const collection = client.db(dbName).collection(collectionName);

export function getEmbeddingsTransformer(): BedrockEmbeddings {
    // try {
    // Ensure embeddingsInstance is initialized only once for efficiency
    if (!embeddingsInstance) {
        embeddingsInstance = new BedrockEmbeddings({ region: process.env.BEDROCK_AWS_REGION!,
            credentials: {
              accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
            },
            model: "amazon.titan-embed-text-v1", 
            maxConcurrency: 3, 
            maxRetries: 5 });
    }
    console.log("Embedding created!")
    return embeddingsInstance;
}

// export function getEmbeddingsTransformer(): BedrockEmbeddings {

//     const embeddings = new BedrockEmbeddings({
//         region: process.env.BEDROCK_AWS_REGION!,
//         credentials: {
//             accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
//             secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
//         },
//         model: "amazon.titan-embed-text-v1",
//     });

//     return embeddings;
// }
export function vectorStore(): MongoDBAtlasVectorSearch {
    const vectorStore: MongoDBAtlasVectorSearch = new MongoDBAtlasVectorSearch(
        new OpenAIEmbeddings(),
        searchArgs()
    );
    return vectorStore
}

export function searchArgs(): MongoDBAtlasVectorSearchLibArgs {
    const searchArgs: MongoDBAtlasVectorSearchLibArgs = {
        collection,
        indexName: "vector_index",
        textKey: "text",
        embeddingKey: "text_embedding",
    }
    return searchArgs;
}