import { MongoDBAtlasVectorSearch, MongoDBAtlasVectorSearchLibArgs,  } from '@langchain/community/vectorstores/mongodb_atlas';
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import { BedrockEmbeddings } from "@langchain/aws";

dotenv.config();

let embeddingsInstance: BedrockEmbeddings | null = null;

const client = new MongoClient(process.env.MONGODB_URI!);
const namespace = "reinvent.travel";
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
            model: "amazon.titan-embed-text-v2:0", 
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
        new BedrockEmbeddings({ region: process.env.BEDROCK_AWS_REGION!,
            credentials: {
              accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
            },
            model: "amazon.titan-embed-text-v2:0", 
            maxConcurrency: 3, 
            maxRetries: 5 }),
        searchArgs()
    );
    return vectorStore
}

export function searchArgs(): MongoDBAtlasVectorSearchLibArgs {
    const searchArgs: MongoDBAtlasVectorSearchLibArgs = {
        collection,
        indexName: "vector_index",
        textKey: "description",
        embeddingKey: "description_embedding",
    }
    return searchArgs;
}

export async function hybridSearch(queryVector: number[], textQuery: string) {
    await client.connect();
    const vectorWeight = 0.5;
    const fullTextWeight = 0.5;
    const extractedString = textQuery.split("Other specifications:")[1]?.trim() || textQuery;
    console.log("extractedString", extractedString);

    const pipeline = [
        {
          '$vectorSearch': {
            'index': 'vector_index', 
            'path': 'description_embedding', 
            'queryVector': queryVector, 
            'numCandidates': 20, 
            'limit': 20
          }
        }, {
          '$addFields': {
            'vs_score': {
              '$meta': 'vectorSearchScore'
            }
          }
        }, {
          '$project': {
            'vs_score': 1, 
            '_id': 1, 
            'description': 1
          }
        }, {
          '$unionWith': {
            'coll': 'travel', 
            'pipeline': [
              {
                '$search': {
                  'index': 'default', 
                  'text': {
                    'query': extractedString, 
                    'path': 'description'
                  }
                }
              }, {
                '$addFields': {
                  'fts_score': {
                    '$divide': [
                      {
                        '$meta': 'searchScore'
                      }, 10
                    ]
                  }
                }
              }, {
                '$limit': 20
              }, {
                '$project': {
                  'fts_score': 1, 
                  '_id': 1, 
                  'text': 1, 
                  'doc_id': 1
                }
              }
            ]
          }
        }, {
          '$group': {
            '_id': '$_id', 
            'description': {
              '$first': '$description'
            }, 
            'vs_score': {
              '$max': '$vs_score'
            }, 
            'fts_score': {
              '$max': '$fts_score'
            }, 
            'doc_id': {
              '$first': '$_id'
            }
          }
        }, {
          '$project': {
            '_id': 1, 
            'description': 1, 
            'doc_id': 1, 
            'vs_score': {
              '$ifNull': [
                '$vs_score', 0
              ]
            }, 
            'fts_score': {
              '$ifNull': [
                '$fts_score', 0
              ]
            }
          }
        }, {
          '$project': {
            'doc_id': 1, 
            'description': 1, 
            'score': {
              '$add': [
                {
                  '$multiply': [
                    '$fts_score', vectorWeight
                  ]
                }, {
                  '$multiply': [
                    '$vs_score', fullTextWeight
                  ]
                }
              ]
            }, 
            '_id': 0, 
            'vs_score': 1, 
            'fts_score': 1
          }
        }, {
          '$sort': {
            'score': -1
          }
        }, {
          '$limit': 20
        }
      ]

    const result = collection.aggregate(pipeline);

    const results = [];
    for await (const doc of result) {
        results.push(doc);
    }

    await client.close();
    return results;
}
