import { ConfigObject } from './types';
import { serialize } from './utils';

/**
 * Interface for the property effect handlers
 */
export type interFace = (element: HTMLElement, propertyName: string, propertyValue: any, propertyConfig: ConfigObject<any>) => void;

/**
 * Trigger a custom event on an element
 *
 * @param element Element to trigger the event on
 * @param _propertyName Name of the property
 * @param _propertyValue Value of a property
 * @param propertyConfig Property configuration object
 */
export function notify(element: HTMLElement, _propertyName: string, _propertyValue: any, propertyConfig: ConfigObject<any>) {
  element.dispatchEvent(new CustomEvent(propertyConfig.notify as string));
}

/**
 * Set an attribute using a property serializer
 *
 * @param element Element to trigger the event on
 * @param _propertyName Name of the property
 * @param propertyValue Value of a property
 * @param propertyConfig Property configuration object
 */
export function reflect(element: HTMLElement, _propertyName: string, propertyValue: any, propertyConfig: ConfigObject<any>) {
  element.setAttribute(propertyConfig.attribute as string, serialize(propertyValue, propertyConfig));
}
