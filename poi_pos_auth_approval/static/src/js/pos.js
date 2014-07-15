openerp.poi_pos_auth_approval = function(instance){

    var module = instance.point_of_sale;
    var QWeb = instance.web.qweb;

	_t = instance.web._t;

    module.PaymentScreenWidget = module.PaymentScreenWidget.extend({

        show: function(){
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            self.get_auth().then(function(){
                if (currentOrder.authorization.state == 'approved' && !currentOrder.keep_approved) {
                    (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'back');
                }
            });
            self._super();
        },

        get_auth: function(){
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            var connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});

            return connection.rpc('/poi_pos_auth_approval/check_validate_order', {
                'config_id': self.pos.config.id,
                'order_id': currentOrder.get_order_id(),
                'current_order': [currentOrder.export_as_JSON()]
            }).then(function(authorization){
                currentOrder.authorization = authorization;
            });
        },

        back: function() {
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            self.get_auth().then(function(){
                switch (currentOrder.authorization.state){
                    case 'submit':
                        alert("Cannot go back before manager sends a response.");
                    break;
                    case 'approved':
                        if(confirm("Manager approved previous requirement. This authorization will be lost if you go back.")) {
                            return (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'back')
                            .then(function(){
                                self.remove_empty_lines();
                                self.pos_widget.screen_selector.set_current_screen(self.back_screen);
                            });
                        }
                    break;
                    case 'rejected':
                        alert("Manager rejected previous request.");
                        return (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'back')
                        .then(function(){
                            self.remove_empty_lines();
                            self.pos_widget.screen_selector.set_current_screen(self.back_screen);
                        });
                    break;
                    default:
                        self.remove_empty_lines();
                        self.pos_widget.screen_selector.set_current_screen(self.back_screen);
                    break;
                }
            });
        },
        validate_order: function(options) {
            var self = this;
            var realvalidate = this._super;

            var connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            var currentOrder = self.pos.get('selectedOrder');

            currentOrder.save_lines_on_db().then(function(){
                //      This is in case S&P was rejected before
                //      we're removing S&P authorization fields to avoid false response
                (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'remove')
            }).then(function(){
                return connection.rpc('/poi_pos_auth_approval/check_validate_order',
                    {'config_id': self.pos.config.id,
                     'order_id': currentOrder.get_order_id(),
                     'current_order': [currentOrder.export_as_JSON()]
                })
            }).then(function(authorization){
                currentOrder.authorization = authorization;
            }).then(function(){
                if(currentOrder.authorization.approved){
                    realvalidate.call(self);
                }else{
                    self.pos_widget.screen_selector.show_popup('ApprovalPopup');
                }
            });
        }
    });

    module.ApprovalPopup = module.PopUpWidget.extend({
        template: 'ApprovalPopup',
        init: function (parent, options) {
            this._super(parent, options);
            this.messages = [];
            this.state = '';
        },
        show: function () {
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            if (currentOrder.authorization.auth_state == undefined)
                currentOrder.authorization.auth_state = 'rejected';

            self.messages = currentOrder.authorization.messages;
            self.state = currentOrder.authorization.auth_state;

            self._super();
            self.renderElement();

            this.$el.find('#app_send').off('click').click(function () {
                self.pos_widget.screen_selector.close_popup();

                var req_msg = self.$el.find('#request_text').val();

                if (currentOrder.sp_reason_txt)
                    req_msg = 'S&P Reason: ' + currentOrder.sp_reason_txt + '<br/>' + req_msg

                return (new instance.web.Model('pos.order')).get_func('send_approval_message')(
                    currentOrder.get_order_id(),
                    currentOrder.authorization.users_notified,
                    currentOrder.authorization.messages,
                    req_msg
                );
            });

            this.$el.find('#app_cancel').off('click').click(function () {

                self.pos_widget.screen_selector.close_popup();

                if (self.state !== 'submit') {
                    if (self.state == 'rejected')
                        (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'reject_notified');

                    if (self.state == 'none')
                        (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'remove');

                    currentOrder.sp_reason = false;
                    currentOrder.authorization.messages = [];
                    currentOrder.authorization.auth_state = 'none';
                }
            });
        }
    });

    module.PosWidget = module.PosWidget.extend({
        init: function(parent, options) {
            this._super(parent, options);
            var  self = this;
        },

        build_widgets: function() {
            this._super();

            //Creating Pop-up "ApprovalPopup"
            this.approval_popup = new module.ApprovalPopup(this, {});
            this.approval_popup.appendTo(this.$el);
            this.screen_selector.add_popup('ApprovalPopup',this.approval_popup);
        }
    });

    module.ProductScreenWidget = module.ProductScreenWidget.extend({
        show: function () {
            var self = this;
            var connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            var currentOrder = self.pos.get('selectedOrder');

            if (currentOrder.get_order_id()){
                connection.rpc('/poi_pos_auth_approval/check_validate_order',{
                    'config_id': self.pos.config.id,
                    'order_id': currentOrder.get_order_id(),
                    'current_order': [currentOrder.export_as_JSON()]
                }).then(function(authorization){
                    currentOrder.authorization = authorization;
                }).then(function(){
                    if(currentOrder.authorization.state == 'submit' || currentOrder.authorization.state == 'approved'){
                        self.pos_widget.screen_selector.set_current_screen('payment');
                    }
                });
            }
            self._super();
        }
    });
};