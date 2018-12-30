import { CONFIG } from './rx-component';
import { ConfigObject, Converter } from './types';
import { toKebabCase } from './utils';

type IndexedObject = { [ key: string ]: any };

/**
 * Gets config out of a prototype or create it if it doesn't exist
 *
 * @param prototype: Class prototype
 * @param propertyKey Key (name) of a decorated property
 *
 * @returns Configuration object for a given property
 */
function getPropertyConfig(prototype: IndexedObject, propertyKey: string | symbol): ConfigObject {
  const config = prototype[ CONFIG ] || (prototype[ CONFIG ] = {});
  const properties = config.properties || (config.properties = {});
  return properties[ propertyKey ] || (properties[ propertyKey ] = {});
}

/**
 * Makes the property be observed for templating and property effects
 *
 * @param attribute Attribute to bind the property to (defaults to kebab-cased property name)
 *
 * @returns Property decorator
 */
export function observe(attribute?: string): PropertyDecorator {
  return (prototype: IndexedObject, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'symbol') {
      throw new TypeError('Only string properties can be observed.');
    }
    const propertyConfig = getPropertyConfig(prototype, propertyKey);
    if (!attribute) {
      attribute = toKebabCase(propertyKey);
    }
    propertyConfig.attribute = attribute;
    if (!propertyConfig.converter) {
      propertyConfig.converter = JSON;
    }
  };
}

/**
 * Makes the property read true/false values from the presence of the attribute (boolean attributes)
 *
 * @returns Property decorator
 */
export function toggleAttr(): PropertyDecorator {
  return (prototype: IndexedObject, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'symbol') {
      throw new TypeError('Only string properties can be observed.');
    }
    const propertyConfig = getPropertyConfig(prototype, propertyKey);
    propertyConfig.converter = Boolean;
  };
}

/**
 * Adds a custom converter to the property (defaults to JSON)
 *
 * @param converter Converter to be used for serialization/deserialization
 *
 * @returns Property decorator
 */
export function withConverter(converter: Converter): PropertyDecorator {
  return (prototype: IndexedObject, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'symbol') {
      throw new TypeError('Only string properties can be observed.');
    }
    const propertyConfig = getPropertyConfig(prototype, propertyKey);
    propertyConfig.converter = converter;
  };
}

/**
 * Makes the property trigger an event whenever it is changed
 *
 * @param eventName Name of an event to trigger (defaults to kebab-cased property name with `-changes` suffix)
 *
 * @returns Property decorator
 */
export function notify(eventName?: string): PropertyDecorator {
  return (prototype: IndexedObject, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'symbol') {
      throw new TypeError('Only string properties can be observed.');
    }
    const propertyConfig = getPropertyConfig(prototype, propertyKey);
    propertyConfig.notify = eventName || `${toKebabCase(propertyKey)}-changed`;
  };
}

/**
 * Makes the property change to be reflected in the attribute (with serialized value)
 *
 * @returns Property decorator
 */
export function reflect(): PropertyDecorator {
  return (prototype: IndexedObject, propertyKey: string | symbol) => {
    if (typeof propertyKey === 'symbol') {
      throw new TypeError('Only string properties can be observed.');
    }
    const propertyConfig = getPropertyConfig(prototype, propertyKey);
    propertyConfig.reflect = true;
  };
}


