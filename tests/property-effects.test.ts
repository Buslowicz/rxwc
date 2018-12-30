import './declarations';
import { expect } from 'chai';
import { notify, reflect } from '../src/property-effects';

describe('Property Effects', () => {
  describe('notify', () => {
    it('should dispatch a custom event named as configured in `notify` config', (done) => {
      notify({
        dispatchEvent(event: CustomEvent) {
          expect(event.type).to.eq('prop-changed');
          done();
        }
      } as any, 'null', null, { notify: 'prop-changed' });
    });
  });
  describe('reflect', () => {
    it('should set an attribute to serialized value of a property', (done) => {
      const propertyValue = { 'test': 1, 'value': true };
      const serializedValue = JSON.stringify(propertyValue);
      reflect({
        setAttribute(name: string, value: string) {
          expect(name).to.eq('attr-name');
          expect(value).to.eq(serializedValue);
          done();
        }
      } as any, 'null', propertyValue, { converter: JSON, attribute: 'attr-name' });
    });
  });
});