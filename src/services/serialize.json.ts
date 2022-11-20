export const stringifyToJSON = <T>(data: T) => JSON.stringify(data);

export const parseJSON = <T>(json: string): T => JSON.parse(json);
