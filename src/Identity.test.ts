import Config from './Config';
import IConfig from './IConfig';
import Need from './Need';
import NeedFilterParams from './drone-charging/NeedFilterParams';
import NeedParams from './drone-charging/NeedParams';
import MissionParams from './drone-charging/MissionParams';
import MessageParams from './drone-charging/MessageParams';
import BidParams from './drone-charging/BidParams';
import { Observable, ID } from './common-types';
import Message from './Message';
import Mission from './Mission';
import Bid from './Bid';

describe('Identity class', () => {

  const TOPIC_ID = 'TOPIC_ID';
  const kafkaError = { msg: 'Kafka error' };
  const davNodeError = { msg: 'Dav node error' };
  const config = new Config({}) as IConfig;
  const needFilterParams = new NeedFilterParams({ area: { lat: 0, long: 0, radius: 0 } });
  const needParams = new NeedParams();
  const bidParams = new BidParams({
    vehicleId: 'DAV_ID',
    price: '100',
  });
  const missionParams = new MissionParams({
    id: 'MISSION_ID',
    neederDavId: 'DAV_ID',
    vehicleId: 'DAV_ID',
    price: '100',
  });

  const forContextSwitch = () => {
    return new Promise((resolve, reject) => {
      jest.useRealTimers();
      setTimeout(resolve, 0);
      jest.useFakeTimers();
    });
  };

  describe('publishNeed method', () => {

    const kafkaMock = {
      generateTopicId: jest.fn(() => TOPIC_ID),
      createTopic: jest.fn(() => Promise.resolve()),
    };

    const axiosMock = {
      post: jest.fn(() => Promise.resolve()),
    };

    beforeAll(() => {
      jest.doMock('./Kafka', () => ({
        default: kafkaMock,
      }));
      jest.doMock('axios', () => ({
        default: axiosMock,
      }));
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call relevant functions and return valid need', async () => {
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('id', 'davId', config);
      const need = new Need(TOPIC_ID, needParams, config);
      await expect(identity.publishNeed(needParams)).resolves.toEqual(need);
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(axiosMock.post).toHaveBeenCalledWith(`${config.apiSeedUrls[0]}/publishNeed/:${TOPIC_ID}`, needParams);
    });

    it('should fail due to dav node exception', async () => {
      axiosMock.post.mockImplementation(() => Promise.reject(davNodeError));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('id', 'davId', config);
      await expect(identity.publishNeed(needParams)).rejects.toEqual(davNodeError);
    });

    it('should fail due to topic creation failure', async () => {
      kafkaMock.createTopic.mockImplementation(() => Promise.reject(kafkaError));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('id', 'davId', config);
      await expect(identity.publishNeed(needParams)).rejects.toThrow(`Topic registration failed: ${kafkaError}`);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

  });

  describe('needsForType method', () => {

    const needParams1 = new NeedParams();
    const needParams2 = new NeedParams();
    const needParams3 = new NeedParams();

    const kafkaMock = {
      generateTopicId: jest.fn(() => TOPIC_ID),
      createTopic: jest.fn(() => Promise.resolve()),
      paramsStream: jest.fn(() => Promise.resolve(Observable.from([
        needParams1, needParams2, needParams3,
      ]))),
    };

    const axiosMock = {
      post: jest.fn(() => Promise.resolve()),
    };

    beforeAll(() => {
      jest.resetModules();
      jest.doMock('./Kafka', () => ({
        default: kafkaMock,
      }));
      jest.doMock('axios', () => ({
        default: axiosMock,
      }));
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should receive needs and relevant functions', async () => {
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const needs = await identity.needsForType(needFilterParams);
      needs.subscribe(spy);
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Need(TOPIC_ID, needParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Need(TOPIC_ID, needParams2, config));
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(axiosMock.post).toHaveBeenCalledWith(`${config.apiSeedUrls[0]}/needsForType/:${TOPIC_ID}`, needFilterParams);
    });

    it('should receive needs with specified topicId and relevant functions', async () => {
      const anotherTopic = 'anotherTopic';
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const needs = await identity.needsForType(needFilterParams, anotherTopic);
      needs.subscribe(spy);
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Need(anotherTopic, needParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Need(anotherTopic, needParams2, config));
      expect(kafkaMock.generateTopicId).not.toHaveBeenCalled();
      expect(kafkaMock.createTopic).not.toHaveBeenCalled();
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

    it('should receive Kafka error event', async () => {
      kafkaMock.paramsStream.mockImplementation(() => Observable.fromPromise(Promise.reject(kafkaError)));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const successSpy = jest.fn();
      const errorSpy = jest.fn();
      const needs = await identity.needsForType(needFilterParams);
      needs.subscribe(successSpy, errorSpy);
      await forContextSwitch();
      expect(successSpy.mock.calls.length).toBe(0);
      expect(errorSpy.mock.calls.length).toBe(1);
      expect(errorSpy.mock.calls[0][0]).toBe(kafkaError);
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(axiosMock.post).toHaveBeenCalledWith(`${config.apiSeedUrls[0]}/needsForType/:${TOPIC_ID}`, needFilterParams);
    });

    it('should fail due to dav node exception', async () => {
      axiosMock.post.mockImplementation(() => Promise.reject(davNodeError));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      await expect(identity.needsForType(needFilterParams)).rejects.toThrow(`Needs registration failed: ${davNodeError}`);
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(axiosMock.post).toHaveBeenCalledWith(`${config.apiSeedUrls[0]}/needsForType/:${TOPIC_ID}`, needFilterParams);
    });

    it('should fail due to topic creation failure', async () => {
      kafkaMock.createTopic.mockImplementation(() => Promise.reject(kafkaError));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      await expect(identity.needsForType(needFilterParams)).rejects.toThrow(`Topic registration failed: ${kafkaError}`);
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(axiosMock.post).not.toHaveBeenCalled();
    });

  });


  describe('missions method', () => {

    const missionParams1 = new MissionParams({
      id: 'MISSION_ID_1',
      neederDavId: 'DAV_ID',
      vehicleId: 'DAV_ID',
      price: '100',
    });
    const missionParams2 = new MissionParams({
      id: 'MISSION_ID_2',
      neederDavId: 'DAV_ID',
      vehicleId: 'DAV_ID',
      price: '100',
    });
    const missionParams3 = new MissionParams({
      id: 'MISSION_ID_3',
      neederDavId: 'DAV_ID',
      vehicleId: 'DAV_ID',
      price: '100',
    });

    const kafkaMock = {
      generateTopicId: jest.fn(() => TOPIC_ID),
      createTopic: jest.fn(() => Promise.resolve()),
      paramsStream: jest.fn(),
    };

    const axiosMock = {
      post: jest.fn(() => Promise.resolve()),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
      jest.resetModules();
      jest.doMock('./Kafka', () => ({
        default: kafkaMock,
      }));
      jest.doMock('axios', () => ({
        default: axiosMock,
      }));
    });

    it('should receive missions and relevant functions', async () => {
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.from([
        missionParams1, missionParams2, missionParams3,
      ])));
      kafkaMock.generateTopicId.mockImplementation(() => TOPIC_ID);
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const missions = await identity.missions();
      missions.subscribe(spy);
      await forContextSwitch();
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Mission(TOPIC_ID, missionParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Mission(TOPIC_ID, missionParams2, config));
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
    });


    it('should receive missions with specified topicId and relevant functions', async () => {
      const anotherTopic = 'anotherTopic';
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.from([
        missionParams1, missionParams2, missionParams3,
      ])));
      kafkaMock.generateTopicId.mockImplementation(() => TOPIC_ID);
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const missions = await identity.missions(anotherTopic);
      missions.subscribe(spy);
      await forContextSwitch();
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Mission(anotherTopic, missionParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Mission(anotherTopic, missionParams2, config));
      expect(kafkaMock.generateTopicId).not.toHaveBeenCalled();
      expect(kafkaMock.createTopic).not.toHaveBeenCalled();
    });

    it('should receive Kafka error event', async () => {
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.fromPromise(Promise.reject(kafkaError))));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const successSpy = jest.fn();
      const errorSpy = jest.fn();
      const missions = await identity.missions();
      missions.subscribe(successSpy, errorSpy);
      await forContextSwitch();
      expect(successSpy.mock.calls.length).toBe(0);
      expect(errorSpy.mock.calls.length).toBe(1);
      expect(errorSpy.mock.calls[0][0]).toBe(kafkaError);
    });

    it('should fail due to topic creation failure', async () => {
      kafkaMock.createTopic.mockImplementation(() => Promise.reject(kafkaError));
      kafkaMock.generateTopicId.mockImplementation(() => TOPIC_ID);
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      await forContextSwitch();
      await expect(identity.missions()).rejects.toThrow(`Topic registration failed: ${kafkaError}`);
      expect(kafkaMock.generateTopicId).toHaveBeenCalled();
      expect(kafkaMock.createTopic).toHaveBeenCalledWith(TOPIC_ID, config);
      expect(kafkaMock.paramsStream).not.toHaveBeenCalled();
    });

  });

  describe('need method', () => {
    beforeAll(() => { /**/ });

    it('should success, validate need', async () => {
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const need = identity.need(needParams);
      expect(need).toEqual(new Need(needParams.id, needParams, config));
    });
  });

  describe('bid method', () => {
    beforeAll(() => { /**/ });

    it('should success, validate bid', async () => {
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const bid = identity.bid('bidId', bidParams);
      expect(bid).toEqual(new Bid('bidId', bidParams, config));
    });
  });

  describe('mission method', () => {
    beforeAll(() => { /**/ });

    it('should success, validate mission', async () => {
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const mission = identity.mission('missionId', missionParams);
      expect(mission).toEqual(new Mission('missionId', missionParams, config));
    });
  });

  describe('messages method', () => {

    const kafkaMock = {
      generateTopicId: jest.fn(),
      createTopic: jest.fn(() => Promise.resolve()),
      paramsStream: jest.fn(),
    };

    const axiosMock = {
      post: jest.fn(() => Promise.resolve()),
    };

    beforeAll(() => {
      jest.doMock('./Kafka', () => ({
        default: kafkaMock,
      }));
      jest.doMock('axios', () => ({
        default: axiosMock,
      }));
    });

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
      jest.resetModules();
    });

    it('should receive message events', async () => {
      const messageParams1 = new MessageParams({ senderId: 'SOURCE_ID_1' });
      const messageParams2 = new MessageParams({ senderId: 'SOURCE_ID_2' });
      const messageParams3 = new MessageParams({ senderId: 'SOURCE_ID_3' });
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.from([
        messageParams1, messageParams2, messageParams3,
      ])));
      kafkaMock.generateTopicId.mockImplementation(() => TOPIC_ID);
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const messages = await identity.messages();
      messages.subscribe(spy);
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Message(TOPIC_ID, messageParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Message(TOPIC_ID, messageParams2, config));
      expect(spy.mock.calls[2][0]).toEqual(new Message(TOPIC_ID, messageParams3, config));
    });

    it('should receive message events with specified topicId', async () => {
      const anotherTopic = 'anotherTopic';
      const messageParams1 = new MessageParams({ senderId: 'SOURCE_ID_1' });
      const messageParams2 = new MessageParams({ senderId: 'SOURCE_ID_2' });
      const messageParams3 = new MessageParams({ senderId: 'SOURCE_ID_3' });
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.from([
        messageParams1, messageParams2, messageParams3,
      ])));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const spy = jest.fn();
      const messages = await identity.messages(anotherTopic);
      messages.subscribe(spy);
      expect(kafkaMock.generateTopicId).not.toHaveBeenCalled();
      expect(kafkaMock.createTopic).not.toHaveBeenCalled();
      expect(spy.mock.calls.length).toBe(3);
      expect(spy.mock.calls[0][0]).toEqual(new Message(anotherTopic, messageParams1, config));
      expect(spy.mock.calls[1][0]).toEqual(new Message(anotherTopic, messageParams2, config));
      expect(spy.mock.calls[2][0]).toEqual(new Message(anotherTopic, messageParams3, config));
    });


    it('should receive error event', async () => {
      kafkaMock.paramsStream.mockImplementation(() => Promise.resolve(Observable.fromPromise(Promise.reject(kafkaError))));
      // tslint:disable-next-line:variable-name
      const Identity: any = (await import('./Identity')).default;
      const identity = new Identity('selfId', 'davId', config);
      const successSpy = jest.fn();
      const errorSpy = jest.fn();
      const messages = await identity.messages();
      messages.subscribe(successSpy, errorSpy);
      await forContextSwitch();
      expect(successSpy.mock.calls.length).toBe(0);
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toBe(kafkaError);
    });

  });

});