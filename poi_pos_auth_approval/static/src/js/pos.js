openerp.poi_pos_auth_approval = function(instance){

    var module = instance.point_of_sale;
    var QWeb = instance.web.qweb;

	_t = instance.web._t;

    module.PaymentScreenWidget = module.PaymentScreenWidget.extend({

        validate_order: function(options) {
            var self = this;
            var realvalidate = this._super;

            var connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            var currentOrder = self.pos.get('selectedOrder');

            // This is in case S&P was rejected before
            // we're removing S&P reason to avoid false response from authorization
            (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'remove').then(function(){
                return connection.rpc('/poi_pos_auth_approval/check_validate_order',{'config_id': self.pos.config.id,
                                                                          'order_id': currentOrder.get_order_id(),
                                                                          'current_order': [currentOrder.export_as_JSON()]
                })
            }).then(function(authorization){
                self.pos.authorization = authorization;
                if(authorization.approved){
                    realvalidate.call(self);
                }else{
                    self.pos_widget.screen_selector.show_popup('ApprovalPopup');
                }
            });
        }
    });

    module.ApprovalPopup = module.PopUpWidget.extend({
        template:'ApprovalPopup',
        init: function(parent, options) {
            this._super(parent, options);
            this.messages = [];
            this.state = '';
        },
        show: function(){
            var self = this;

            self.messages = self.pos.authorization.messages;

            console.log("SP_SP 1 self.pos.authorization.state", self.pos.authorization.state);
            console.log("SP_SP 1 self.state", self.state);

            if (self.pos.authorization.state == 'rejected')
                self.state = self.pos.authorization.state;

            console.log("SP_SP 2 self.state", self.state);

            self._super();
            self.renderElement();

            var currentOrder = this.pos.get('selectedOrder');
            var usr_notif = self.pos.authorization.users_notified;

            this.$el.find('#app_send').off('click').click(function(){

                (new instance.web.Model('pos.order')).get_func('send_approval_message')(
                    currentOrder.get_order_id(),
                    usr_notif,
                    self.messages,
                    self.$el.find('#request_text').val()
                );
                self.state = 'submit';
                self.pos_widget.screen_selector.close_popup();
            });

            this.$el.find('#app_cancel').off('click').click(function(){

                // if "cancel" authorization request then "remove S&P reason"
                //(new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), '');

                self.pos_widget.screen_selector.close_popup();
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
};