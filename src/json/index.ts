export function parseJSON(data: string) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
}

export function stringfyJSON(data: any) {
  try {
    return JSON.stringify(data);
  } catch (e) {
    return data;
  }
}

export function isJSON(data: string) {
  try {
    JSON.parse(data);
    return true;
  } catch (e) {
    return false;
  }
}
