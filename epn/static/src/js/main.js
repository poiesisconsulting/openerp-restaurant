openerp.epn = function(instance){

	var _t = instance.web._t;
    var module = instance.point_of_sale;

    // handles application urls
    // when an appurl for the pos is called (openerp-pos://), the
    // registered pingback for the appurl is called. The pingback
    // are assigned by the guid query string parameter, the rest of the
    // url is ignored. 

    module.PingbackDispatcher = instance.web.Class.extend({
        init: function(){
            var self = this;
            this.pingback = {};

        },
        register: function(guid,callback){
            this.pingback[guid] = callback;
        },
        unregister: function(guid){
            delete this.pingback[guid];
        },
        dispatch: function(url){

            // decodes a querystring param without urlcomponent decoding
            // as it would otherwise corrupt the base64 signature
            function getParameterByNameNoDecode(name,url) {
                name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
                var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                    results = regex.exec(url);
                return results == null ? "" : decodeURIComponent(results[1]);
            }

            var params = url.substring(url.indexOf('?')+1);
            var params = $.deparam(params);
                params.signature = getParameterByNameNoDecode('signature',url)

            if(params.guid && this.pingback[params.guid]){
                this.pingback[params.guid](params);
            }
        },
    });

    window.pingbacks = new module.PingbackDispatcher();

    // Phonegap needs this function to handle the application url
    window.handleOpenURL = function(url) {
        setTimeout(function () {
            window.pingbacks.dispatch(url);
        }, 0);
    }

    // we need a way to uniquely identify the paymentline Ids during communication
    // with the payment app
    var paymentlineId  = 1;

    var oldPaymentline = module.Paymentline;
    module.Paymentline = module.Paymentline.extend({
        initialize: function(attributes, options){
            oldPaymentline.prototype.initialize.call(this,attributes,options);
            this.paymentlineId = paymentlineId++;
            this.status   = 'unconfirmed';
            this.signature = false;
            this.epn_info  = '';
            this.guid      = false;

            if (this.cashregister.journal.type === 'bank') {
                this.epn_info = 'NO_INFO';
            }

        },
        export_as_JSON: function(){
            var json = oldPaymentline.prototype.export_as_JSON.call(this);
            json.signature = this.signature;
            json.epn_info  = this.epn_info;
            console.log(json);
            return json;
        },
    });

    var oldOrder = module.Order;
    module.Order = module.Order.extend({
        removePaymentline: function(line){
            oldOrder.prototype.removePaymentline.call(this,line);
            pingbacks.unregister(line.guid);
        },
    });


    module.PaymentScreenWidget.include({
        confirm_paymentline: function(line,status){
            line.status    = 'confirmed';
            line.epn_info  = status.info || 'NO_INFO';
            line.signature = status.signature || false;
            this.rerender_paymentline(line);
        },
        add_paymentline: function(line){
            var self   = this;

            if(line.cashregister.journal.type !== 'bank'){
                this._super(line);
                return;
            }

            line.guid = this.pos.session.session_id + 
                '-' + this.pos.get('selectedOrder').sequence_number + 
                '-' + line.paymentlineId;
            var pingback = "openerp-pos://pos/confirm_payment/?guid="+line.guid;
            var appurl = "easy-epn://?amount=" + (line.amount || 0).toFixed(2) + "&pingback="+encodeURIComponent(pingback);

            console.log(pingback);

            pingbacks.register(line.guid,function(params){
                self.confirm_paymentline(line,params);
                pingbacks.unregister(line.guid);
            });

            line.status = 'waiting';

            setTimeout(function(){ 
                // setting window.location interrupts pending rpcs. 
                // putting it in a set-timeout gives some time for this screen's rpcs finish
                window.location = appurl;
            },250);

            this._super(line);
        },
        get_pending_payments: function(){
            var order = this.pos.get('selectedOrder');
            var lines = order.get('paymentLines').models;
            var pending = [];

            for(var i = 0; i < lines.length; i++){
                var line = lines[i];
                if(line.status === 'waiting' || line.status === 'canceled'){
                    pending.push(line);
                }
            }

            return pending;
        },
        back:function(){
            var self = this;
            var realback = this._super;
            var order    = this.pos.get('selectedOrder');
            var pending  = this.get_pending_payments();

            if(pending.length > 0){
                this.pos_widget.screen_selector.show_popup('confirm',{
                    message: _t('Interrupt Credit Card Payment ?'),
                    comment: _t('Some credit cards payments are still waiting for confirmation from the banking system.'),
                    confirm: function(){
                        for(var i = 0; i < pending.length; i++){
                            order.removePaymentline(pending[i]);
                        }
                        realback.call(self);
                    },
                });
            }else{
                realback.call(self);
            }
        },
        validate_order: function(options){
            var self = this;
            var realvalidate = this._super;
            var order   = this.pos.get('selectedOrder');
            var pending = this.get_pending_payments();

            if(pending.length > 0){
                this.pos_widget.screen_selector.show_popup('confirm',{
                    message: _t('Validate Unconfirmed Credit Card Payments ?'),
                    comment: _t('Some credit cards payments are still waiting for confirmation from the banking system.'),
                    confirm: function(){ realvalidate.call(self); },
                });
            }else{
                realvalidate.call(self);
            }
        },
        close: function(){
            var lines = this.pos.get('selectedOrder').get('paymentLines').models;

            for(var i = 0; i < lines.length; i++){
                pingbacks.unregister(lines[i].guid);
            }

            this._super();
        },
    });
};
