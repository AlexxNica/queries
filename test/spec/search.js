'use strict';

const expect = require('chai').expect;
const elasticsearch = require('elasticsearch');
const nock = require('nock');
const nockBack = require('nock').back;
const queries = require('../../');

const localEsClient = new elasticsearch.Client({ host: '127.0.0.1:9200', log: null, apiVersion: '2.4' });

describe('search()', () => {
    it('should return the desired results', () => {
        let nockDone;

        nockBack('search-gulpplugin-sass.json', (_nockDone) => { nockDone = _nockDone; });

        return queries.search('keywords:gulpplugin sass', localEsClient)
        .then((res) => {
            expect(res.total).to.equal(68);
            expect(res.results).to.have.length(25);
            expect(res.results[0]).to.contain.all.keys('package', 'score', 'searchScore');
            expect(res.results[0].package.name).to.equal('gulp-sass');
            nockDone();
        });
    });

    it('should return the desired results of a complex query', () => {
        let nockDone;

        nockBack('search-complex-query-spawn.json', (_nockDone) => { nockDone = _nockDone; });

        return queries.search('maintainer:satazor keywords:spawn,-foo is:deprecated not:insecure boost-exact:no spawn', localEsClient)
        .then((res) => {
            expect(res.total).to.equal(1);
            expect(res.results).to.have.length(1);
            expect(res.results[0].package.name).to.equal('cross-spawn-async');
            nockDone();
        });
    });

    it('should allow to search all packages of an author', () => {
        let nockDone;

        nockBack('search-author-sindresorhus.json', (_nockDone) => { nockDone = _nockDone; });

        return queries.search('author:sindresorhus', localEsClient)
        .then((res) => {
            expect(res.total).to.equal(767);
            expect(res.results).to.have.length(25);
            res.results.forEach((result) => expect(result.package.author.username).to.equal('sindresorhus'));
            nockDone();
        });
    });

    it('should make use of options.from and options.size', () => {
        nock('http://127.0.0.1:9200')
        .post('/npms-current/score/_search', (post) => {
            expect(post.size).to.equal(1);
            expect(post.from).to.equal(1);

            return post;
        })
        .reply(200, {
            hits: {
                total: 0,
                hits: [],
            },
        });

        return queries.search('foo', localEsClient, { from: 1, size: 1 })
        .then((res) => {
            expect(res.total).to.equal(0);
            expect(res.results).to.have.length(0);
            expect(nock.isDone()).to.equal(true);
        });
    });

    it('should accept a elasticsearch config as the second argument', () => {
        let nockDone;

        nockBack('search-gulpplugin-sass.json', (_nockDone) => { nockDone = _nockDone; });

        return queries.search('keywords:gulpplugin sass', { host: '127.0.0.1:9200', log: null, apiVersion: '2.4' })
        .then((res) => {
            expect(res.total).to.equal(68);
            nockDone();
        });
    });

    it('should not fail on invalid qualifiers by default', () => {
        let nockDone;

        nockBack('search-gulpplugin-sass.json', (_nockDone) => { nockDone = _nockDone; });

        return queries.search('keywords:gulpplugin is:foo sass', localEsClient)
        .then((res) => {
            expect(res.total).to.equal(68);
            nockDone();
        });
    });

    it('should fail if q has invalid qualifiers and options.throwOnInvalid is enabled', () => {
        return queries.search('keywords:gulpplugin is:foo sass', localEsClient, { throwOnInvalid: true })
        .then(() => {
            throw new Error('Should have failed');
        }, (err) => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.message).to.contain('deprecated, unstable, insecure');
        });
    });

    it('should return 0 results if no text or filter qualifiers were specified', () => {
        return queries.search('score-effect:1 quality-weight:1 popularity-weight:1 maintenance-weight:1 boost-exact:false', localEsClient)
        .then((res) => expect(res).to.eql({ total: 0, results: [] }));
    });
});
