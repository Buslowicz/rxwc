import './declarations';
import { expect } from 'chai';
import { asyncScheduler, of, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { observe, toggleAttr, withConverter } from '../src/decorators';
import { RxComponent, RxWC } from '../src/rx-component';
import { serialize } from '../src/utils';

describe('RxComponent', () => {
  const fakeRenderer = (_template: any, _target: Element | ShadowRoot) => {};
  describe('initialization', () => {
    it('should create setters and getters for each observed property', () => {
      class Test extends RxComponent(fakeRenderer, false) {
        @observe() prop1: number | null = null;
        @observe() prop2: string | null = null;

        template() {}
      }

      const instance = new Test();
      const descriptors = Object.getOwnPropertyDescriptors(instance);
      expect(descriptors).to.include.keys('prop1', 'prop2');
      expect(descriptors.prop1).to.include.keys('get', 'set');
      expect(descriptors.prop2).to.include.keys('get', 'set');
    });
    it('should create shadow dom if not set otherwise', () => {
      let called = false;

      class Test extends RxComponent(fakeRenderer, true) {
        @observe() prop1: number | null = null;
        @observe() prop2: string | null = null;

        attachShadow(_mode: { mode: string }) {
          called = true;
          return null as any;
        }

        template() {
          return JSON.stringify(this);
        }
      }

      new Test();
      expect(called).to.be.true;
    });
    it('should return observed properties list from observedAttributes getter', function () {
      class Test extends RxComponent(fakeRenderer, false) {
        @observe() prop1: number | null = null;
        @observe() prop2: string | null = null;

        template() {}
      }

      expect((Test as any as typeof RxWC).observedAttributes).to.deep.eq([ 'prop1', 'prop2' ]);

    });
  });
  describe('properties', () => {
    it('should allow using getters/setters of the BehaviorSubject without attaching to DOM', () => {
      class Test extends RxComponent(fakeRenderer, false) {
        @observe() prop1?: number;
        @observe() prop2?: string;

        template() {
          return JSON.stringify(this);
        }
      }

      const instance = new Test();
      expect(instance.prop1).to.be.undefined;
      expect(instance.prop2).to.be.undefined;
      instance.prop1 = 0;
      instance.prop2 = '';
      expect(instance.prop1).to.eq(0);
      expect(instance.prop2).to.eq('');
    });
    it('should deserialize attribute value whenever it is changed', () => {
      class CustomConverter {
        static parse(string: string): CustomConverter {
          return Object.assign(new CustomConverter(), JSON.parse(string));
        }

        toString(): string {
          return JSON.stringify(this);
        }
      }

      class Test extends RxComponent(fakeRenderer, false) {
        @observe() prop1?: number;
        @observe() prop2?: string;
        @observe() prop3?: boolean;
        @withConverter(URL) @observe() prop4?: URL;
        @withConverter(CustomConverter) @observe() prop5?: CustomConverter;

        template() {
          return JSON.stringify(this);
        }
      }

      const instance = new Test();
      instance[ 'attributeChangedCallback' ]('prop1', '', '1');
      expect(instance.prop1).to.eq(1);

      instance[ 'attributeChangedCallback' ]('prop2', '', 'test');
      expect(instance.prop2).to.eq('test');
      instance[ 'attributeChangedCallback' ]('prop2', '', '"test2"');
      expect(instance.prop2).to.eq('test2');

      instance[ 'attributeChangedCallback' ]('prop3', '', 'true');
      expect(instance.prop3).to.be.true;
      instance[ 'attributeChangedCallback' ]('prop3', '', 'false');
      expect(instance.prop3).to.be.false;

      instance[ 'attributeChangedCallback' ]('prop4', '', 'http://localhost/path');
      expect(instance.prop4).to.be.instanceOf(URL);
      expect(instance.prop4).to.include({ hostname: 'localhost', pathname: '/path' });

      instance[ 'attributeChangedCallback' ]('prop5', '', '{ "test": true }');
      expect(instance.prop5).to.be.instanceOf(CustomConverter);
      expect(instance.prop5).to.include({ test: true });
    });
    it('should read toggle attributes as boolean', () => {
      class Test extends RxComponent(fakeRenderer, false) {
        @toggleAttr() @observe() prop?: boolean;

        template() {}
      }

      const instance = new Test();
      instance[ 'attributeChangedCallback' ]('prop', 'null', '');
      expect(instance.prop).to.be.true;
      instance[ 'attributeChangedCallback' ]('prop', '', 'null');
      expect(instance.prop).to.be.false;
    });
    it('should emit each property change in an observable stream', () => {
      let called: number;

      class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
        @observe() prop1: number = 1;
        @observe() prop2: string = 'a';
        @observe() prop3: boolean = false;

        template() {}
      }

      const instance = new Test();

      const total: { [ key: string ]: any; } = {};

      instance[ 'connectedCallback' ]();
      instance[ 'subscribe' ](instance.propertyChanged$.pipe(tap(([ key, value ]) => {
        total[ key ] = value;
        called++;
      })));
      called = 0;
      instance.prop1 = 2;
      expect(called).to.eq(1);
      instance.prop2 = 'b';
      expect(called).to.eq(2);
      instance.prop3 = true;
      expect(called).to.eq(3);

      expect(total).to.deep.eq({ prop1: 2, prop2: 'b', prop3: true });
    });
  });
  describe('template', () => {
    async function pause(delay: number) {
      return new Promise(resolve => setTimeout(resolve, delay));
    }

    it('should render changes throttled by provided scheduler', async () => {
      let prop: number = 0;
      let prints = 0;

      class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
        @observe() prop: number = prop;

        template() {
          prop = this.prop;
          prints++;
        }
      }

      const instance = new Test();
      expect(prop).to.eq(0);
      instance[ 'connectedCallback' ]();
      instance.prop = 1;
      expect(prop).to.eq(0);
      await pause(25);
      expect(prop).to.eq(1);
      await pause(25);
      instance.prop = 2;
      instance.prop = 3;
      instance.prop = 4;
      instance.prop = 10;
      expect(prop).to.eq(2);
      await pause(25);
      expect(prop).to.eq(10);
      instance[ 'disconnectedCallback' ]();
      expect(prints).to.eq(4);
    });
    it('should skip duplicate property changes', async () => {
      let prints = 0;

      class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
        @observe() prop: number = 0;

        template() {
          prints++;
        }
      }

      const instance = new Test();
      instance[ 'connectedCallback' ]();
      prints = 0;
      instance.prop = 1;
      await pause(25);
      expect(prints).to.eq(1);
      instance.prop = 1;
      await pause(25);
      instance.prop = 1;
      await pause(25);
      instance.prop = 1;
      await pause(25);
      instance.prop = 1;
      await pause(25);
      instance.prop = 1;
      await pause(25);
      instance[ 'disconnectedCallback' ]();
      expect(prints).to.eq(1);
    });
    it('should stop repaining when the element is unattached, and resume when it is reattached', async () => {
      let prints = 0;

      class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
        @observe() prop: number = 0;

        template() { prints++; }
      }

      const instance = new Test();
      instance[ 'connectedCallback' ]();
      expect(prints).to.eq(1);
      await pause(25);
      instance.prop++;
      await pause(25);
      expect(prints).to.eq(2);
      instance[ 'disconnectedCallback' ]();
      instance.prop++;
      await pause(25);
      expect(prints).to.eq(2);
      instance[ 'connectedCallback' ]();
      expect(prints).to.eq(3);
      instance.prop++;
      await pause(25);
      expect(prints).to.eq(4);
    });
  });
  describe('subscriber', () => {
    context('subscribe', () => {
      it('should subscribe observables when element is attached to DOM', () => {
        let called = false;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        expect(called).to.be.false;
        instance[ 'connectedCallback' ]();
        expect(called).to.be.false;
        instance[ 'subscribe' ](of(null).pipe(tap(() => called = true)));
        expect(called).to.be.true;
      });
      it('should not subscribe observables until the element is attached', () => {
        let called = false;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        expect(called).to.be.false;
        instance[ 'subscribe' ](of(null).pipe(tap(() => called = true)));
        expect(called).to.be.false;
        instance[ 'connectedCallback' ]();
        expect(called).to.be.true;
      });
      it('should only subscribe the same observables once', () => {
        let called = 0;
        const observable = of(null).pipe(tap(() => called++));

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](observable, observable);
        instance[ 'subscribe' ](observable);
        expect(called).to.eq(1);
      });
    });
    context('unsubscribe', () => {
      it('should unsubscribe the observable', () => {
        const sub = new Subject();
        let called = 0;
        const observable = sub.pipe(tap(() => called++));

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](observable);
        sub.next();
        expect(called).to.eq(1);
        instance[ 'unsubscribe' ](observable);
        sub.next();
        expect(called).to.eq(1);
      });
    });
  });
  describe('lifecycles', () => {
    context('connected$', () => {
      it('should trigger the observable whenever element is connected to the DOM', () => {
        let called = 0;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](instance.connected$.pipe(tap(() => called++)));
        expect(called).to.eq(0);
        instance[ 'disconnectedCallback' ]();
        expect(called).to.eq(0);
        instance[ 'connectedCallback' ]();
        expect(called).to.eq(1);
      });
    });
    context('disconnected$', () => {
      it('should trigger the observable whenever element is disconnected from the DOM', () => {
        let called = 0;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop?: number;

          template() {}
        }

        const instance = new Test();
        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](instance.disconnected$.pipe(tap(() => called++)));
        expect(called).to.eq(0);
        instance[ 'disconnectedCallback' ]();
        expect(called).to.eq(1);
      });
    });
    context('attributeChanged$', () => {
      it('should trigger the observable whenever a property changes', () => {
        let called = 0;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop1: number = 1;
          @observe() prop2: number = 2;

          template() {}
        }

        const instance = new Test();

        const prop1Observable = instance.attributeChanged$.pipe(filter(({ name }) => name === 'prop1'), tap(({ name, from, to }) => {
          expect(name).to.eq('prop1');
          expect(from).to.eq('1');
          expect(to).to.eq('3');
          called++;
        }));

        const prop2Observable = instance.attributeChanged$.pipe(filter(({ name }) => name === 'prop2'), tap(({ name, from, to }) => {
          expect(name).to.eq('prop2');
          expect(from).to.eq('2');
          expect(to).to.eq('4');
          called++;
        }));

        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](prop1Observable, prop2Observable);
        expect(called).to.eq(0);
        instance[ 'attributeChangedCallback' ]('prop1', '1', '3');
        expect(called).to.eq(1);
        instance[ 'attributeChangedCallback' ]('prop2', '2', '4');
        expect(called).to.eq(2);
      });
      it('should not trigger the observable if new and old values are the same', function () {
        let called = 0;

        class Test extends RxComponent(fakeRenderer, false, asyncScheduler) {
          @observe() prop1: number = 1;

          template() {}
        }

        const instance = new Test();

        const prop1Observable = instance.attributeChanged$.pipe(tap(() => called++));

        instance[ 'connectedCallback' ]();
        instance[ 'subscribe' ](prop1Observable);
        expect(called).to.eq(0);
        instance[ 'attributeChangedCallback' ]('prop1', '1', '3');
        expect(called).to.eq(1);
        instance[ 'attributeChangedCallback' ]('prop1', '3', '3');
        expect(called).to.eq(1);
      });
    });
  });
  describe('serializer', () => {
    it('should use JSON.stringify to serialize properties with JSON converter', () => {
      expect(serialize(1, { converter: JSON } as any)).to.eq('1');
      expect(serialize('a', { converter: JSON } as any)).to.eq('"a"');
      expect(serialize(true, { converter: JSON } as any)).to.eq('true');
      expect(serialize(null, { converter: JSON } as any)).to.eq('null');
    });
    it('should return href to serialize properties with URL converter', () => {
      const url = 'http://localhost/pathname';
      expect(serialize(new URL(url), { converter: URL } as any)).to.eq(url);
    });
    it('should return value wrapped with template string for falsy values', () => {
      expect(serialize(null, {} as any)).to.eq('null');
      expect(serialize(undefined, {} as any)).to.eq('undefined');
      expect(serialize(false, {} as any)).to.eq('false');
      expect(serialize(0, {} as any)).to.eq('0');
    });
    it('should call .toString() for custom serializers', () => {
      expect(serialize({ toString() { return 'fake'; } }, {} as any)).to.eq('fake');
    });
    it('should throw EvalError if there is no toString method', () => {
      expect((() => serialize({ toString: null }, {} as any))).to.throw(EvalError);
    });
  });
});
