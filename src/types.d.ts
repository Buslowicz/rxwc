import {  SchedulerLike } from 'rxjs';
import { ConfigObject } from './types';

/**
 * Interface for the renderer function
 */
export interface RendererFunction {
  /**
   * @param template Template to render
   * @param target Target for the renderer (where to output the resulting html)
   */
  (template: any, target: Element | ShadowRoot): void
}

/**
 * Built-in converters supported by the library
 */
export type BuiltInConverters = typeof JSON | typeof URL | typeof Boolean;

/**
 * Converter interface (for serializing and deserializing data)
 */
export type Converter<T extends { toString(): string } = any> = { new(): T, parse(string: string): T } | BuiltInConverters;

/**
 * Interface for a property configuration object
 */
export interface ConfigObject<T = any> {
  /** Converter to be used for property serialization/deserialization */
  converter: Converter<T>;
  /** Attribute name to read property value from */
  attribute: string;
  /** Whether to notify about the property change (if so, it is a name of the event) */
  notify: string;
  /** Whether to reflect the property value back to an attribute */
  reflect: boolean;
}

/**
 * Component configuration interface
 */
export interface ComponentConfig {
  /** Properties configurations object */
  properties: { [ propertyName: string ]: ConfigObject<any> };
  /** Renderer to be used by the library */
  renderer: RendererFunction;
  /** Whether to use shadow dom */
  useShadow: boolean;
  /** Scheduler to be used for subsequent prints */
  scheduler: SchedulerLike
}