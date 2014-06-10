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
            connection.rpc('/poi_pos_auth_approval/check_validate_order',{'config_id': self.pos.config.id,
                                                                                'order_id': currentOrder.get_order_id(),
                                                                                'current_order': [currentOrder.export_as_JSON()]}).then(function(authorization){
                self.pos.authorization = authorization;
                if(authorization.approved){
                    realvalidate.call(self);
                }else{
                    self.pos_widget.screen_selector.show_popup('ApprovalPopup');
                }
            });
        },
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
            self.state = self.pos.authorization.state;

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
                self.pos_widget.screen_selector.close_popup();
            });

            this.$el.find('#app_cancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        },
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
        },
    });
}