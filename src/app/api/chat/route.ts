import { streamText, Message } from 'ai';
import { hybridSearch, getEmbeddingsTransformer } from '@/utils/mongodb';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

var results:any = [];
var hybridSearchQuery:any = [];

// Bedrock configuration
const bedrockConfig = {
    region: process.env.BEDROCK_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
    },
};

async function retrieveContext(query: string) {
    // const results = await vectorStore().similaritySearch(query, 3);
    const queryVector = await getEmbeddingsTransformer().embedQuery(query);
    // console.log("queryVector", queryVector);
    results = await hybridSearch(queryVector, query);
    const contextIds = results[0].map((result: { description: any; }) => result.description).join(', ');
    hybridSearchQuery = results[1]
    return contextIds;
}

export async function POST(req: Request) {
    const body = await req.json();

    if (!body) {
        console.log('Prompt is required', body);
        return new Response('Prompt is required', { status: 400 });
    }

    try {
        // Retrieve context from MongoDB using vector search
        const messages: Message[] = body.messages ?? [];
        const question = messages[messages.length - 1].content;
        const chatHistory = messages.map(message => {
            const role = message.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${message.content}`;
        }).join('\n');

        const context = await retrieveContext(question);

        // Construct the full body with context
        // const systemPrompt = 'You are a travel agent who only responds in JSON.\
        // You must format your output as a JSON value that adheres to a given "JSON Schema" instance.\
        // "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.\
        // For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}\
        // would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.\
        // Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.\
        // Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!\
        // Here is the JSON Schema instance your output must adhere to, Include the enclosing markdown codeblock\
        //   ```\
        //   [\
        //     "properties": {\
        //       "day": {\
        //         "type": "integer",\
        //         "description": "The day number of the itinerary."\
        //       },\
        //       "title": {\
        //         "type": "string",\
        //         "description": "The title of the days activities."\
        //       },\
        //       "description": {\
        //         "type": "string",\
        //         "description": "A brief description of the days activities."\
        //       },\
        //       "activities": {\
        //         "type": "array",\
        //         "items": {\
        //           "type": "object",\
        //           "properties": {\
        //             "time": {\
        //               "type": "string",\
        //               "description": "The time of the activity."\
        //             },\
        //             "activity": {\
        //               "type": "string",\
        //               "description": "The name of the activity."\
        //             },\
        //             "details": {\
        //               "type": "string",\
        //               "description": "Additional details about the activity."\
        //             },\
        //             "location": {\
        //               "type": "object",\
        //               "description": "The latitude and longitude of the activity location."\
        //               "properties": {\
        //                 "lat": {\
        //                   "type": "number",\
        //                   "description": "The latitude of the location."\
        //                 },\
        //                 "lng": {\
        //                   "type": "number",\
        //                   "description": "The longitude of the location."\
        //             }\
        //   ]\
        //   ```\
        // ';

        const systemPrompt = "You are a helpful travel wizard who is assisting a user in planning their trip.\
        You must provide a detailed itinerary for the user's trip.\
        The format of your answer should be as follows .\
        ~~Day: The day number of the itinerary\
        ~~Title: The title of the days activities\
        ~~Description: A brief description of the days activities, end the string with {lat: latitude, lng: longitude} values of the spot.\
        Each day must start with one # sign. \
        \
        For example, \
        #~Day 1: Mesmerizing Paris\
         ~~Title: Eiffel Tower Visit\
         ~~Description: ‣ 10:00 AM | Eiffel Tower | Visit the Eiffel Tower and enjoy the breathtaking view of Paris. {lat: 24.3245, lng: 23.12523} \n\
                        ‣ 12:30 PM | Plaza | Have lunch at the plaza. {lat: 32.124, lng: 12.235}\
        #~Day 2: Exploring Paris\
        ~~Title: Louvre Museum Visit\
        ~~Description: ‣ 10:30 AM | Louvre Museum | Explore the Louvre Museum and discover the world-famous art collection. {lat: 12.234, lng: 23.325}\
        \
        Your output should follow this format always. Always add multiple activities for each day.";

        const fullPrompt = `Instructions : ${systemPrompt} \
        \n\nContext: ${context}\
        \n\nUser Query: ${question}\
        \n\nChat History: ${chatHistory} \
        please provide a response, based on the above context and query. Add a liner about the itinerary at the top and keep it conversational. \
        Restrict your knowledge to only the provided context. Reply with I don't know if you don't know the answer. \
        Do not make up answers.`;

        // Initialize the language model
        const bedrock = createAmazonBedrock({
            bedrockOptions: bedrockConfig
        });

        const model = bedrock('anthropic.claude-3-sonnet-20240229-v1:0', {
            additionalModelRequestFields: { top_k: 10 },
        });

        const stream = streamText({
            model: model,
            prompt: fullPrompt,
        });

        return (await stream).toDataStreamResponse();

    } catch (error) {
        console.error('Error generating text:', error);
        return new Response('Error generating text', { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        return new Response( JSON.stringify({"results" : results, "hybridSearchQuery" : hybridSearchQuery}), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error retrieving context:', error);
        return new Response('Error retrieving context', { status: 500 });
    }
}