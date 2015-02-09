var Form = require('../../');

var _ = require('underscore'),
    EventEmitter = require('events').EventEmitter;

describe('Form Controller', function () {

    beforeEach(function () {
        sinon.spy(EventEmitter.prototype, 'emit');
    });
    afterEach(function () {
        EventEmitter.prototype.emit.restore();
    });

    it('exports a constructor', function () {
        Form.should.be.a('function');
    });

    it('implements event emitter', function () {
        var form = new Form({ template: 'index' });
        form.should.be.an.instanceOf(EventEmitter);
    });

    it('throws if both template is undefined', function () {
        var fn = function () {
            return new Form({});
        };
        fn.should.throw();
    });

    it('has `get` and `post` methods', function () {
        var form = new Form({ template: 'index' });
        form.get.should.be.a('function');
        form.post.should.be.a('function');
    });

    it('has a `requestHandler` method', function () {
        var form = new Form({ template: 'index' });
        form.requestHandler.should.be.a('function');
    });

    describe('requestHandler', function () {

        var form, handler, req, res, cb;

        beforeEach(function () {
            form = new Form({ template: 'index' });
            sinon.stub(form, 'get');
            sinon.stub(form, 'post');
            sinon.stub(form, 'errorHandler');
            req = request({
                params: {}
            }),
            res = {
                send: sinon.stub()
            };
            cb = function callback() {};
            handler = form.requestHandler();
        });

        it('returns a function', function () {
            form.requestHandler().should.be.a('function');
        });

        describe('returned function', function () {

            it('calls form.get in response to get requests', function () {
                req.method = 'GET';
                handler(req, res, cb);
                form.get.should.have.been.calledWith(req, res);
                form.get.should.have.been.calledOn(form);
            });

            it('calls form.post in response to post requests', function () {
                req.method = 'POST';
                handler(req, res, cb);
                form.post.should.have.been.calledWith(req, res);
                form.post.should.have.been.calledOn(form);
            });

            it('sends error in response to put requests', function () {
                req.method = 'PUT';
                handler(req, res, cb);
                res.send.should.have.been.calledWith(405);
            });

            it('sends error in response to delete requests', function () {
                req.method = 'DELETE';
                handler(req, res, cb);
                res.send.should.have.been.calledWith(405);
            });

            it('calls error handler if method calls back with an error', function () {
                req.method = 'POST';
                form.post.yields({ error: 'message' });
                handler(req, res, cb);
                form.errorHandler.should.have.been.calledOnce;
                form.errorHandler.should.have.been.calledWith({ error: 'message' }, req, res, cb);
                form.errorHandler.should.have.been.calledOn(form);
            });

        });

    });

    describe('get', function () {

        var form, req, res, cb;

        beforeEach(function () {
            form = new Form({
                template: 'index',
                next: '/next',
                fields: {
                    field: 'name'
                }
            });
            req = request({
                path: '/index',
                params: {},
                flash: sinon.stub().returns([])
            });
            res = {
                render: sinon.stub()
            };
            cb = sinon.stub();
            sinon.stub(Form.prototype, 'getValues').yields(null, {});
        });

        afterEach(function () {
            Form.prototype.getValues.restore();
        });

        it('calls form.getValues', function () {
            form.get(req, res, cb);
            form.getValues.should.have.been.calledWith(req, res);
            form.getValues.should.have.been.calledOn(form);
        });

        it('renders the provided template', function () {
            form = new Form({ template: 'test' });
            form.get(req, res, cb);
            res.render.should.have.been.calledWith('test');
        });

        it('if path is "/" and no template is provided uses "index for template', function () {
            form = new Form({ template: 'index' });
            form.get(req, res, cb);
            res.render.should.have.been.calledWith('index');
        });

        it('passes the next page to the rendered template', function () {
            form = new Form({ template: 'index', next: 'otherpage' });
            form.get(req, res, cb);
            res.render.args[0][1].nextPage.should.equal('otherpage');
        });

        it('passes any errors to the rendered template', function () {
            req.flash.returns([{ field: { message: 'error' } }]);
            form.get(req, res, cb);
            res.render.args[0][1].errors.should.eql({ field: { message: 'error' } });
        });

        it('does not include errors from fields not in the form', function () {
            req.flash.returns([
                { field: { message: 'error' }, 'other-field': { message: 'error' } }
            ]);
            form.get(req, res, cb);
            res.render.args[0][1].errors.should.eql({ field: { message: 'error' } });
        });

        it('includes errors from fields in forms "allowedErrors" list', function () {
            req.flash.returns([
                { field: { message: 'error' }, 'other-field': { message: 'error' } }
            ]);
            form.options.allowedErrors = ['other-field'];
            form.get(req, res, cb);
            res.render.args[0][1].errors.should.eql({
                field: { message: 'error' },
                'other-field': { message: 'error' }
            });
        });

        it('passes output of getValues to the rendered template', function () {
            req.flash.returns([]);
            form.getValues.yields(null, { values: [1] });
            form.get(req, res, cb);
            res.render.args[0][1].values.should.eql({ values: [1] });
        });

        it('calls callback with error if getValues fails', function () {
            req.flash.returns([]);
            form.getValues.yields({ error: 'message' });
            form.get(req, res, cb);
            cb.should.have.been.calledOnce;
            cb.should.have.been.calledWithExactly({ error: 'message' });
        });

        it('includes req.flash(`values`) in rendered response', function () {
            req.flash.returns([{ 'other-values': [2] }]);
            form.getValues.yields(null, { values: [1] });
            form.get(req, res, cb);
            res.render.args[0][1].values.should.eql({ values: [1], 'other-values': [2] });
        });

        it('includes form options in rendered response', function () {
            form.get(req, res, cb);
            res.render.args[0][1].options.should.eql(form.options);
        });

        it('uses req.path as form action by default', function () {
            form.get(req, res, cb);
            res.render.args[0][1].action.should.equal('/index');
        });

        it('prefixes req.path with req.baseUrl if it is defined', function () {
            req.baseUrl = '/base';
            form.get(req, res, cb);
            res.render.args[0][1].action.should.equal('/base/index');
        });

        it('uses action from getValues as form action if it exists', function () {
            form.getValues.yields(null, {
                action: '/custom-action'
            });
            form.get(req, res, cb);
            res.render.args[0][1].action.should.equal('/custom-action');
        });

        it('emits "complete" event if form has no fields', function () {
            form.options.fields = {};
            form.get(req, res, cb);
            form.emit.withArgs('complete').should.have.been.calledOnce;
            form.emit.withArgs('complete').should.have.been.calledOn(form);
            form.emit.should.have.been.calledWithExactly('complete', req, res);
        });

        it('does not emit "complete" event if form has fields', function () {
            form = new Form({ template: 'index', fields: { key: {} } });
            form.get(req, res, cb);
            form.emit.withArgs('complete').should.not.have.been.called;
        });

        it('does not emit "complete" event if form has no defined next step', function () {
            delete form.options.next;
            form.get(req, res, cb);
            form.emit.withArgs('complete').should.not.have.been.called;
        });

    });

    describe('post', function () {

        var form, req, res, cb;
        var validators = Form.validators;

        beforeEach(function () {
            cb = sinon.stub();
            form = new Form({
                template: 'index',
                next: 'success',
                fields: {
                    field: { formatter: 'uppercase', validate: 'required' },
                    email: { validate: ['required', 'email'] },
                    name: { validate: ['required', { type: 'minlength', arguments: [10] }, { type: 'maxlength', arguments: 20 }] },
                    bool: { formatter: 'boolean' },
                    options: { options: [ 'one', { value: 'two' }, 'three' ] }
                }
            });
            req = request({
                flash: sinon.stub(),
                body: {
                    field: 'value',
                    name: 'Joe Smith',
                    email: 'test@example.com',
                    bool: 'true'
                }
            });
            res = {};
            sinon.stub(Form.prototype, 'validate').yields(null);
            sinon.stub(Form.prototype, 'saveValues').yields(null);
            sinon.stub(Form.prototype, 'successHandler');
            _.each(validators, function (fn, key) {
                sinon.stub(validators, key).returns(true);
            });
        });

        afterEach(function () {
            Form.prototype.validate.restore();
            Form.prototype.saveValues.restore();
            Form.prototype.successHandler.restore();
            _.each(validators, function (fn, key) {
                validators[key].restore();
            });
        });

        it('writes field values to req.form.values', function () {
            form.post(req, res, cb);
            req.form.values.should.have.keys([
                'field',
                'email',
                'name',
                'bool',
                'options'
            ]);
        });

        it('call callback with error if _process fails', function () {
            var cb = sinon.stub();
            sinon.stub(form, '_process').yields('error');
            form.post(req, res, cb);
            cb.should.have.been.calledOnce;
            cb.should.have.been.calledWith('error');
        });

        it('formats posted values according to `fields` option', function () {
            form.post(req, res, cb);
            req.form.values.field.should.equal('VALUE');
            req.form.values.bool.should.equal(true);
        });

        it('validates the fields', function () {
            form.post(req, res, cb);
            validators.required.should.have.been.calledWith('VALUE');
        });

        it('validates fields with multiple validators defined', function () {
            form.post(req, res, cb);
            validators.required.should.have.been.calledWith('test@example.com');
            validators.email.should.have.been.calledWith('test@example.com');
        });

        it('validates fields with parameterised validators defined', function () {
            req.body = {
                name: '  John Smith  '
            };
            form.post(req, res, cb);
            validators.required.should.have.been.calledWith('John Smith');
            validators.minlength.should.have.been.calledWith('John Smith', 10);
        });

        it('validates fields with parameterised validators defined as single values', function () {
            req.body = {
                name: 'A name longer than twenty characters'
            };
            form.post(req, res, cb);
            validators.maxlength.should.have.been.calledWith('A name longer than twenty characters', 20);
        });

        it('adds an equality validator if field has options defined', function () {
            req.body = {
                options: 'number'
            };
            form.post(req, res, cb);
            validators.equal.should.have.been.calledOnce;
            validators.equal.should.have.been.calledWith('number', 'one', 'two', 'three');
        });

        it('calls out to form.validate', function () {
            form.post(req, res, cb);
            form.validate.should.have.been.calledWith(req, res);
            form.validate.should.have.been.calledOn(form);
        });

        describe('valid inputs', function () {

            it('calls form.saveValues', function () {
                form.post(req, res, cb);
                form.saveValues.should.have.been.calledWith(req, res);
                form.saveValues.should.have.been.calledOn(form);
            });

            it('calls form.successHandler if saved successfully', function () {
                form.post(req, res, cb);
                form.successHandler.should.have.been.calledWith(req, res);
                form.successHandler.should.have.been.calledOn(form);
            });

            it('calls callback if not saved successfully', function () {
                form.saveValues.yields({ error: true });
                form.post(req, res, cb);
                cb.should.have.been.calledWith({ error: true });
            });

        });

        describe('invalid inputs', function () {

            it('calls callback with validation errors matching failed validation type', function () {
                validators.email.returns(false);
                req.body.email = 'foo';
                form.post(req, res, cb);
                cb.should.have.been.calledOnce;
                Object.keys(cb.args[0][0]).should.eql(['email']);
                _.each(cb.args[0][0], function (err, key) {
                    err.type.should.equal('email');
                    err.key.should.equal(key);
                });
            });

            it('does not continue validating if field validation fails', function () {
                validators.required.returns(false);
                form.post(req, res, cb);
                cb.should.have.been.called;
                form.validate.should.not.have.been.called;
            });

            it('validation of a field stops at the first error', function () {
                validators.required.withArgs('test@example.com').returns(false);
                form.post(req, res, cb);
                cb.should.have.been.calledOnce;
                Object.keys(cb.args[0][0]).should.eql(['email']);
                _.each(cb.args[0][0], function (err, key) {
                    err.type.should.equal('required');
                    err.key.should.equal(key);
                });
                validators.email.should.not.have.been.called;
            });

            it('all fields are validated', function () {
                validators.required.returns(false);
                req.body = { field: 'value', email: 'foo', name: 'John' };
                form.post(req, res, cb);
                cb.should.have.been.calledOnce;
                Object.keys(cb.args[0][0]).should.eql(['field', 'email', 'name']);
                _.each(cb.args[0][0], function (err, key) {
                    err.type.should.equal('required');
                    err.key.should.equal(key);
                });
                validators.email.should.not.have.been.called;
            });

        });

        describe('invalid form-level validation', function () {

            beforeEach(function () {
                Form.prototype.validate.yields({ field: 'invalid' });
            });

            it('calls callback with validation errors', function () {
                form.post(req, res, cb);
                cb.should.have.been.calledWith({ field: 'invalid' });
            });

        });

    });

    describe('successHandler', function () {

        var form, req, res;

        beforeEach(function () {
            form = new Form({ template: 'index', next: 'success' });
            req = request({
                params: {},
                body: { field: 'value' },
                flash: sinon.stub()
            });
            res = {
                redirect: sinon.stub()
            };
        });

        it('redirects to `next` page', function () {
            form.successHandler(req, res);
            res.redirect.should.have.been.calledWith('success');
        });

        it('prefixes redirect url with req.baseUrl', function () {
            req.baseUrl = 'base/';
            form.successHandler(req, res);
            res.redirect.should.have.been.calledWith('base/success');
        });

        it('emits "complete" event', function () {
            form.successHandler(req, res);
            form.emit.withArgs('complete').should.have.been.calledOnce;
            form.emit.withArgs('complete').should.have.been.calledOn(form);
            form.emit.should.have.been.calledWithExactly('complete', req, res);
        });

    });

    describe('errorHandler', function () {

        var form, req, res, err;

        beforeEach(function () {
            err = new Form.Error('field');
            form = new Form({ template: 'index', next: 'success' });
            req = request({
                path: '/index',
                form: {
                    values: { field: 'value' }
                },
                flash: sinon.stub()
            });
            res = {
                redirect: sinon.stub()
            };
        });

        it('sets errors to `req.flash` if redirecting to self', function () {
            form.errorHandler({ field: err }, req, res);
            req.flash.should.have.been.calledWith('errors', { field: err });
        });

        it('redirects to req.path if no redirecting error is defined', function () {
            form = new Form({ template: 'index' });
            form.errorHandler({ field: err }, req, res);
            res.redirect.should.have.been.calledWith('/index');
        });

        it('redirects to error redirect if any error has a redirect property', function () {
            err.redirect = '/exitpage';
            form.errorHandler({ field: err }, req, res);
            res.redirect.should.have.been.calledWith('/exitpage');
        });

        it('prefixes redirect with req.baseUrl if it is defined', function () {
            req.baseUrl = '/foo';
            form.errorHandler({ field: err }, req, res);
            res.redirect.should.have.been.calledWith('/foo/index');
        });

        it('calls callback if error is not a validation error', function () {
            var cb = sinon.stub();
            var err = new Error('message');
            form.errorHandler(err, req, res, cb);
            cb.should.have.been.calledOnce;
            cb.should.have.been.calledWith(err);
        });

    });

});