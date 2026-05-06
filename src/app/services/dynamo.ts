import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
	region: process.env.AWS_REGION || 'us-east-1',
	credentials: process.env.AWS_SESSION_TOKEN
		? {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
				sessionToken: process.env.AWS_SESSION_TOKEN,
		  }
		: undefined,
});

export const db = DynamoDBDocumentClient.from(client);
