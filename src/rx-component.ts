import { animationFrameScheduler, BehaviorSubject, merge, noop, Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, startWith, tap, throttleTime } from 'rxjs/operators';
import * as propertyEffects from './property-effects';
import { ComponentConfig, RendererFunction } from './types';
import { deserialize, toCamelCase, toKebabCase } from './utils';

/** Component config accessor */
export const CONFIG = '@config';

/**
 * Base class for RxComponent
 */
export abstract class RxWC extends HTMLElement {
  /** Subject for connectedCallback */
  private '@connected': Subject<never> | null = null;
  /** Subject for disconnectedCallback */
  private '@disconnected': Subject<never> | null = null;
  /** Subject for attributeChangedCallback */
  private '@attributeChanged': Subject<{ name: string, from: any, to: any }> | null = null;
  /** Observable emitting a [key, value] pair on each observed property change */
  private readonly '@propertyChanged': Observable<[ string, any ]>;
  /** Set of registered Observable streams subscribing and unsubscribing on component being attached/detached accordingly */
  private readonly '@streams': Set<Observable<any>> = new Set();
  /** Map of active subscriptions per registered stream */
  private readonly '@subscriptions': Map<Observable<any>, Subscription> = new Map();
  /** DOM root of an element (either an element or shadow root) */
  private readonly '@root': Element | ShadowRoot;
  /** Whether element is currently attached */
  protected isAttached = false;
  /** Component configuration object */
  public [ CONFIG ]: ComponentConfig;

  /**
   * Observed attributes getter as per specs
   *
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements
   */
  public static get observedAttributes(this: { prototype: RxWC }) {
    return Object.keys(this.prototype[ CONFIG ].properties || {}).map(toKebabCase);
  }

  /**
   * Observable stream of connected event
   */
  public get connected$() {
    return this[ '@connected' ] || (this[ '@connected' ] = new Subject());
  }

  /**
   * Observable stream of disconnected event
   */
  public get disconnected$() {
    return this[ '@disconnected' ] || (this[ '@disconnected' ] = new Subject());
  }

  /**
   * Observable stream of attribute changed event
   */
  public get attributeChanged$() {
    return this[ '@attributeChanged' ] || (this[ '@attributeChanged' ] = new Subject());
  }

  /**
   * Observable stream of property changes event
   */
  public get propertyChanged$() {
    return this[ '@propertyChanged' ];
  }

  /**
   * Getter of an components root element
   */
  public get root() {
    return this[ '@root' ];
  }

  protected constructor() {
    super();
    const { [ CONFIG ]: { properties: props = {}, renderer, useShadow = true, scheduler } } = this;

    this[ '@root' ] = useShadow ? this.attachShadow({ mode: 'open' }) : this;
    const triggers = this.createPropertiesDescriptors(Object.keys(props));

    this[ '@propertyChanged' ] = merge(...Object
      .entries(triggers)
      .map(([ propertyName, trigger ]: [ string, BehaviorSubject<any> ]) => {
        const propertyConfig = props[ propertyName ];
        return trigger.pipe(
          // /* Property effects */
          tap((propertyValue) => {
            Object
              .entries<propertyEffects.interFace>(propertyEffects)
              .filter(([ effect ]) => effect in propertyConfig)
              .forEach(([ , handler ]) => handler(this, propertyName, propertyValue, propertyConfig))
          }),
          distinctUntilChanged(),
          map<any, [ string, any ]>((value) => [ propertyName, value ])
        );
      })
    );
    this[ '@streams' ].add(
      this[ '@propertyChanged' ].pipe(
        Object.keys(props).length === 0 ? startWith(null) : tap(noop),
        throttleTime(0, scheduler, { leading: true, trailing: true }),
        /* Pre-render effects start */
        /* Pre-render effects end */
        /* Rendering */
        tap(() => renderer(this.template(), this.root))
        /* Post-render effects start */
        /* Post-render effects end */
      )
    );
  }

  /**
   * Creates getter and setter for a trigger (BehaviorSubject) for each property
   *
   * @param props List of properties names
   *
   * @returns Trigger for each provided property
   */
  private createPropertiesDescriptors(props: Array<string>): { [ propertyName: string ]: BehaviorSubject<any> } {
    const triggers: { [ propertyName: string ]: BehaviorSubject<any> } = {};
    Object.defineProperties(this, props
      .reduce((proto, key) => {
        const trigger = new BehaviorSubject(undefined);
        triggers[ key ] = trigger;
        proto[ key ] = {
          get: () => trigger.getValue(),
          set: (newValue: any) => trigger.next(newValue)
        };
        return proto;
      }, {} as PropertyDescriptorMap));
    return triggers;
  }

  /**
   * Method called each time an observed attribute is changed
   *
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements
   */
  protected attributeChangedCallback(attr: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) {
      return;
    }
    this.attributeChanged$.next({ name: attr, from: oldValue, to: newValue });
    const propertyName = toCamelCase(attr);
    const { [ CONFIG ]: { properties } } = this;

    (this as any)[ propertyName ] = deserialize(newValue, properties[ propertyName ]);
  }

  /**
   * Method called each time a component is attached to DOM
   *
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements
   */
  protected connectedCallback() {
    this.isAttached = true;
    this[ '@streams' ].forEach((stream) => this[ '@subscriptions' ].set(stream, stream.subscribe()));
    this.connected$.next();
  }

  /**
   * Method called each time a component is detached from DOM
   *
   * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements
   */
  protected disconnectedCallback() {
    this.isAttached = false;
    this.disconnected$.next();
    if (!this[ '@subscriptions' ]) {
      return;
    }
    this[ '@subscriptions' ].forEach((sub) => sub.unsubscribe());
    this[ '@subscriptions' ].clear();
  }

  /**
   * Subscribes provided observable streams each time a component is attached to dom and unsubscribes whenever it is detached
   *
   * @param streams Streams to subscribe
   */
  protected subscribe(...streams: Array<Observable<any>>) {
    streams.forEach((stream) => this[ '@streams' ].add(stream));
    if (!this.isAttached) {
      return;
    }
    streams.forEach((stream) => {
      if (this[ '@subscriptions' ].has(stream)) {
        return;
      }
      return this[ '@subscriptions' ].set(stream, stream.subscribe());
    });
  }

  /**
   * Unsubscribe provided observable streams and remove them from the streams list,
   * making them no longer subscribed on component being attached
   *
   * @param streams Streams to unsubscribe
   */
  protected unsubscribe(...streams: Array<Observable<any>>) {
    streams.forEach((stream) => this[ '@streams' ].delete(stream));
    streams.forEach((stream) => {
      const sub = this[ '@subscriptions' ].get(stream);
      if (!sub) {
        return;
      }
      sub.unsubscribe();
      this[ '@subscriptions' ].delete(stream);
    });
  }

  /**
   * Method returns a template for the component
   */
  abstract template(): any;
}

/**
 * Mixin that provides a class that extends RxWC component. Mixin accepts configuration which is then passed to the class.
 *
 * @param renderer Render function to be used for rendering
 * @param useShadow Whether to use shadow dom
 * @param scheduler Scheduler used for subsequent template prints
 *
 * @returns Base class for components
 */
export function RxComponent(renderer: RendererFunction, useShadow = true, scheduler = animationFrameScheduler) {
  const config = { renderer, useShadow, properties: {}, scheduler };
  return class RxComponent extends (RxWC as any as { new(): any }) {
    get [ CONFIG ]() { return config; }
  } as any as { new(): RxWC };
}
