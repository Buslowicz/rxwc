import './declarations';
import { expect } from 'chai';
import { notify, observe, reflect, toggleAttr, withConverter } from '../src/decorators';
import { CONFIG } from '../src/rx-component';
import { ComponentConfig } from '../src/types';

describe('Decorators', () => {
  function getConfig(cls: any): ComponentConfig {
    return cls.prototype[ CONFIG ]
  }
  describe('observe', () => {
    it('should create a config for the class if it does not exist', () => {
      class Test {
        @observe() prop1 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.attribute': 'prop1' });
    });
    it('should not override existing config', () => {
      class Test {
        @observe() prop1 = true;
        @observe() prop2 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.attribute': 'prop1', 'properties.prop2.attribute': 'prop2' });
    });
    it('should use kebab-cased property name as an attribute to observe, if no name was provided', () => {
      class Test {
        @observe() myProperty = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.myProperty.attribute': 'my-property' });
    });
    it('should accept a name of an attribute to observe and add it to the property config', () => {
      class Test {
        @observe('my-attribute') prop1 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.attribute': 'my-attribute' });
    });
    it('should throw TypeError if used on symbol properties', () => {
      expect((() => {
        const propAccessor = Symbol();
        // @ts-ignore
        class Test {
          @observe() public [ propAccessor ] = true;
        }
      })).to.throw(TypeError);
    });
  });
  describe('toggleAttr', () => {
    it('should set converter to Boolean', () => {
      class Test {
        @toggleAttr() prop1 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.converter': Boolean });
    });
    it('should throw TypeError if used on symbol properties', () => {
      expect((() => {
        const propAccessor = Symbol();
        // @ts-ignore
        class Test {
          @toggleAttr() public [ propAccessor ] = true;
        }
      })).to.throw(TypeError);
    });
  });
  describe('withConverter', () => {
    it('should add a converter to the property config', () => {
      class Converter {
        static parse() {}
      }

      class Test {
        @withConverter(Converter) @observe() prop1 = true;
        @observe() @withConverter(Converter) prop2 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.converter': Converter, 'properties.prop2.converter': Converter });
    });
    it('should throw TypeError if used on symbol properties', () => {
      expect((() => {
        const propAccessor = Symbol();
        // @ts-ignore
        class Test {
          @withConverter(JSON) public [ propAccessor ] = true;
        }
      })).to.throw(TypeError);
    });
  });
  describe('notify', () => {
    context('when called without an argument', () => {
      it('should set `notify` flag on a property config using kebab cased property name', () => {
        class Test {
          @notify() myProp = true;
        }

        expect(getConfig(Test)).to.nested.include({ 'properties.myProp.notify': 'my-prop-changed' });
      });
    });
    context('when called with an argument', () => {
      it('should use the provided string argument as a change event name', () => {
        class Test {
          @notify('prop-updated') myProp = true;
        }

        expect(getConfig(Test)).to.nested.include({ 'properties.myProp.notify': 'prop-updated' });
      });
    });
    it('should throw TypeError if used on symbol properties', () => {
      expect((() => {
        const propAccessor = Symbol();
        // @ts-ignore
        class Test {
          @notify() public [ propAccessor ] = true;
        }
      })).to.throw(TypeError);
    });
  });
  describe('reflect', () => {
    it('should set `reflect` flag to true on the property config', () => {
      class Test {
        @reflect() prop1 = true;
      }

      expect(getConfig(Test)).to.nested.include({ 'properties.prop1.reflect': true });
    });
    it('should throw TypeError if used on symbol properties', () => {
      expect((() => {
        const propAccessor = Symbol();
        // @ts-ignore
        class Test {
          @reflect() public [ propAccessor ] = true;
        }
      })).to.throw(TypeError);
    });
  });
});