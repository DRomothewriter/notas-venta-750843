import { db } from './dynamo';
import {
	PutCommand,
	GetCommand,
	UpdateCommand,
	DeleteCommand,
	ScanCommand,
} from '@aws-sdk/lib-dynamodb';

export async function putItem(table: string, item: any) {
	await db.send(new PutCommand({ TableName: table, Item: item }));
}

export async function getItem(table: string, key: any) {
	const result = await db.send(
		new GetCommand({ TableName: table, Key: key }),
	);
	return result.Item;
}

export async function updateItem(
	table: string,
	key: any,
	updateExpression: string,
	values: any,
) {
	await db.send(
		new UpdateCommand({
			TableName: table,
			Key: key,
			UpdateExpression: updateExpression,
			ExpressionAttributeValues: values,
		}),
	);
}

export async function deleteItem(table: string, key: any) {
	await db.send(new DeleteCommand({ TableName: table, Key: key }));
}

export async function getAll(table: string) {
	const result = await db.send(new ScanCommand({ TableName: table }));
	return result.Items;
}
