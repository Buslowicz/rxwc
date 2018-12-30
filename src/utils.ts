import { ConfigObject } from './types';

/**
 * (TypeGuard) Checks if converter is a URL
 *
 * @param converter Converter to check
 *
 * @returns Whether provided converter is a URL
 */
function isURL(converter: any): converter is typeof URL {
  return converter === URL;
}

/**
 * (TypeGuard) Checks if converter is a Boolean
 *
 * @param converter Converter to check
 *
 * @returns Whether provided converter is a Boolean
 */
function isBoolean(converter: any): converter is typeof Boolean {
  return converter === Boolean;
}

/**
 * Converts camelCased string into kebab-cased one
 *
 * @param prop String to transform
 *
 * @returns Transformed string
 */
export function toKebabCase(prop: string): string {
  let replacer = (_: string, a: string, b: string) => `${a}-${b.toLowerCase()}`;
  return prop.replace(/([a-z0-9])([A-Z])/g, replacer).replace(/([\w])_([\w])/g, replacer);
}

/**
 * Converts kebab-cased string into camelCased one
 *
 * @param attr String to transform
 *
 * @returns Transformed string
 */
export function toCamelCase(attr: string): string {
  return attr.replace(/[-_]([\w\d])/g, (_, c) => c.toUpperCase());
}

/**
 * Deserializes the string into proper value using the provided converter
 *
 * @param value String to deserialize
 * @param converter Converter to be used
 *
 * @returns Deserialized value
 */
export function deserialize(value: string, { converter }: ConfigObject) {
  if (isBoolean(converter)) {
    return value !== 'null';
  } else if (isURL(converter)) {
    return new URL(value);
  } else if (converter && converter !== JSON) {
    return converter.parse(value);
  }
  if ([ 'null', 'false', 'true' ].includes(value) || [ '[', '{', '"' ].includes(value.charAt(0)) || /\d+/.test(value)) {
    return JSON.parse(value);
  }
  return value;
}

/**
 * Serializes the value into to string using the provided converter
 *
 * @param value Value to serialize
 * @param config Converter to be used
 *
 * @returns Serialized value as a string
 */
export function serialize(value: any, { converter }: ConfigObject) {
  if (converter === JSON) {
    return JSON.stringify(value);
  }
  if (converter === URL) {
    return (value as URL).href;
  }
  if (!value) {
    return `${value}`;
  }
  if (value.toString) {
    return value.toString()
  }
  throw new EvalError('Invalid serializer');
}
