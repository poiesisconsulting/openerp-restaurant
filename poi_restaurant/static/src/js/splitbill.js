function openerp_restaurant_splitbill(instance, module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;

    module.SplitbillScreenWidget = module.ScreenWidget.extend({
        template: 'SplitbillScreenWidget',

        show_leftpane:   false,
        previous_screen: 'products',

        renderElement: function(){
            var self = this;
            this._super();
            var order = this.pos.get('selectedOrder');
            if(!order){
                return;
            }
            var orderlines = order.get('orderLines').models;
            for(var i = 0; i < orderlines.length; i++){
                var line = orderlines[i];
                linewidget = $(QWeb.render('SplitOrderline',{ 
                    widget:this, 
                    line:line, 
                    selected: false,
                    quantity: 0,
                    id: line.id,
                }));
                linewidget.data('id',line.id);
                this.$('.orderlines').append(linewidget);
            }
            this.$('.back').click(function(){
                self.pos_widget.screen_selector.set_current_screen(self.previous_screen);
            });
        },

        lineselect: function($el,order,neworder,splitlines,line_id){
            var split = splitlines[line_id] || {'quantity': 0, line: null};
            var line  = order.getOrderline(line_id);
            
            if( !line.get_unit().groupable ){
                if( split.quantity !== line.get_quantity()){
                    split.quantity = line.get_quantity();
                }else{
                    split.quantity = 0;
                }
            }else{
                if( split.quantity < line.get_quantity()){
                    split.quantity += line.get_unit().rounding;
                    if(split.quantity > line.get_quantity()){
                        split.quantity = line.get_quantity();
                    }
                }else{
                    split.quantity = 0;
                }
            }

            if( split.quantity ){
                if ( !split.line ){
                    split.line = line.clone();
                    neworder.addOrderline(split.line);
                }
                split.line.set_quantity(split.quantity);
            }else if( split.line ) {
                neworder.removeOrderline(split.line);
                split.line = null;
            }
     
            splitlines[line_id] = split;
            $el.replaceWith($(QWeb.render('SplitOrderline',{
                widget: this,
                line: line,
                selected: split.quantity !== 0,
                quantity: split.quantity,
                id: line_id,
            })));
            this.$('.order-info .subtotal').text(this.format_currency(neworder.getSubtotal()));
        },

        pay: function($el,order,neworder,splitlines,cashregister_id){

            var self = this;

            var orderlines = order.get('orderLines').models;
            var empty = true;
            var full  = true;

            for(var i = 0; i < orderlines.length; i++){
                var id = orderlines[i].id;
                var split = splitlines[id];
                if(!split){
                    full = false;
                }else{
                    if(split.quantity){
                        empty = false;
                        if(split.quantity !== orderlines[i].get_quantity()){
                            full = false;
                        }
                    }
                }
            }
            
            if(empty){
                return;
            }

            for(var i = 0; i < this.pos.cashregisters.length; i++){
                if(this.pos.cashregisters[i].id === cashregister_id){
                    var cashregister = this.pos.cashregisters[i];
                    break;
                }
            }

            if(full){
                order.addPaymentline(cashregister);
                this.pos_widget.screen_selector.set_current_screen('payment');
            }else{
                var lines_to_remove = [];
                for(var id in splitlines){
                    var split = splitlines[id];
                    var line  = order.getOrderline(parseInt(id));
                    line.set_quantity(line.get_quantity() - split.quantity);
                    if(Math.abs(line.get_quantity()) < 0.00001){
                        order.removeOrderline(line);
                        lines_to_remove.push(line.get_orderline_id());
                    }
                    delete splitlines[id];
                }
                neworder.addPaymentline(cashregister);
                //neworder.set_screen_data('screen','payment');
                //Added by Poiesis to create a new order when you're splitting an order
                (new instance.web.Model('pos.order')).get_func('duplicate_order_from_ui')(order.get_order_id(),lines_to_remove, {}).then(function(new_order_id){
                    neworder.set_order_id(new_order_id.order_id);
                    neworder.assign_tables(new_order_id.tables);
                    neworder.set_timestamp(1);
                }).then(function(){
                    neworder.start_synch();
                }).then(function(){
                    self.pos.get('orders').add(neworder);
                    self.pos.set('selectedOrder',neworder);
                }).then(function(){
                    neworder.set_screen_data('screen','payment');
                    self.pos_widget.screen_selector.set_current_screen('payment');
                });

            }
        },
        show: function(){
            var self = this;
            this._super();
            this.renderElement();

            var order = this.pos.get('selectedOrder');

            if (order.everything_on_kitchen())
            {
                var neworder = new module.Order({
                    pos: this.pos,
                    temporary: true,
                });
                neworder.set('client',order.get('client'));

                var splitlines = {};

                this.$('.orderlines').on('click','.orderline',function(){
                    var id = parseInt($(this).data('id'));
                    var $el = $(this);
                    self.lineselect($el,order,neworder,splitlines,id);
                });

                this.$('.paymentmethod').click(function(){
                    var id = parseInt($(this).data('id'));
                    var $el = $(this);
                    self.pay($el,order,neworder,splitlines,id);
                });
            }
            else
            {
                alert('You have to send all the lines to the kitchen');
                self.pos_widget.screen_selector.set_current_screen(self.previous_screen);
            }

        },
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            if(this.pos.config.iface_splitbill){
                this.splitbill_screen = new module.SplitbillScreenWidget(this,{});
                this.splitbill_screen.appendTo(this.$('.screens'));
                this.screen_selector.add_screen('splitbill',this.splitbill_screen);

                var splitbill = $(QWeb.render('SplitbillButton'));

                splitbill.click(function(){
                    var currentOrder = self.pos.get('selectedOrder');

                    if(currentOrder.get('orderLines').models.length > 0) {
                        self.get_auth().then(function() {

                                //Authorizations: Remove auth. state first and then go with the split process
                                if (currentOrder.authorization.state != 'none') {
                                    if (confirm("Your authorization process will be lost. Continue?")) {
                                        (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'back')
                                            .then(function () {
                                                self.pos_widget.screen_selector.set_current_screen('splitbill');
                                            });
                                    }
                                } else self.pos_widget.screen_selector.set_current_screen('splitbill');

                        });
                    }
                });
                
                splitbill.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
            }
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
        }
    });
}
