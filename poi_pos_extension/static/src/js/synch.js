function poi_extension_synch(instance, module){

    module.SynchOrders = module.PosBaseWidget.extend({
		init: function(parent, options){
        	var self = this;
            var options = options || {};
            this._super(parent,options);

            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            this.synch_domain=[];

            this.pos.selected_order_id = false;
            this.pos.synched_orders = [];

            //This variable is to avoid duplicate connections
            this.connected = false;

        },
        save_actual_order: function(){
            var self = this;
            var actual_order = self.pos.get('selectedOrder');

            if (actual_order && actual_order.get_order_id()){
                self.pos.selected_order_id = actual_order.get_order_id();
            }
            else
            {
                self.pos.selected_order_id = false;
            }
        },
        set_domain: function(domain){
            this.synch_domain=domain;
        },
        fetch_ids: function(domain, context){
            var result = [];
            this.save_actual_order();
            context = context || {};
            return this.connection.rpc('/poi_pos_extension/get_order_ids',{'domain': domain, 'context': context}).then(function(res){
                return res.orders;
            });
        },
        get_order: function(order_id){
            return this.connection.rpc('/poi_pos_extension/get_order_data',{'order_id': order_id});
        },
        get_orderlines: function(order_id){
            return this.connection.rpc('/poi_pos_extension/get_orderline_data',{'order_id': order_id});
        },
        get_order_timestamp: function(order_id){
            return this.connection.rpc('/poi_pos_extension/get_orders_timestamp',{'order_ids': [order_id]});
        },
        assign_values_to_order: function(order, order_data){
            order.set_order_id(order_data.id);
            order.set_timestamp(order_data.timestamp);
            //set_client
        },
        assign_values_to_orderline: function(orderline, orderline_data){
            orderline.set_quantity(orderline_data.qty);
            orderline.set_discount(orderline_data.discount);
            orderline.set_unit_price(orderline_data.price_unit);
            orderline.set_orderline_id(orderline_data.id);
            orderline.set_unique_name(orderline_data.unique_name);
        },
        compare_order_data: function(order, order_data){
            //We need some conditions to do this
            if (order.get_timestamp() != order_data.timestamp){
                order.set_timestamp(order_data.timestamp);
            }
        },
        compare_orderline_data: function(orderline, orderline_data){
            if (orderline.get_quantity() != orderline_data.qty)
            {
                orderline.set_quantity(orderline_data.qty);
            }
            if (orderline.get_discount() != orderline_data.discount)
            {
                orderline.set_discount(orderline_data.discount);
            }
            if (orderline.get_unit_price() != orderline_data.price_unit)
            {
                orderline.set_unit_price(orderline_data.price_unit);
            }
            if (orderline.get_orderline_id() != orderline_data.id)
            {
                orderline.set_orderline_id(orderline_data.id);
            }
            if (orderline.get_unique_name() != orderline_data.unique_name)
            {
                orderline.set_unique_name(orderline_data.unique_name);
            }
        },
        add_new_orderline: function(order, orderline_data){
            product=this.pos.db.get_product_by_id(orderline_data.product_id[0]);
            var line = new module.Orderline({}, {pos: this.pos, order: order, product: product});
            this.assign_values_to_orderline(line, orderline_data);
            order.get('orderLines').add(line);
        },
        set_flag_to_remove_all_orders: function(){
            this.pos.add_new_order();
            if (this.pos.get('orders').length>1){
                this.pos.get('orders').chain()
                .map(function(new_order) {
                    new_order.set_removal_flag();
                });
            }
        },
        set_flag_to_remove_nonused_orders: function(orders){
            var self = this;
            var selectedOrder = this.pos.get('selectedOrder');

            if (this.pos.get('orders').length>1){
                this.pos.get('orders').chain()
                .map(function(new_order) {
                    if (new_order.get_order_id()){
                        if ($.inArray( new_order.get_order_id(), orders ) == -1){
                        new_order.set_removal_flag();
                    };
                    }
                    else
                    {
                        if (new_order.uid!=selectedOrder.uid){
                            new_order.set_removal_flag();
                        }
                    }
                });
            }
        },
        set_flag_to_remove_order: function(order_id){
			this.pos.get('orders').chain()
            .map(function(new_order) {
                if (new_order.get_order_id()==order_id){
                    new_order.set_removal_flag();
                }
            });
        },
        set_flag_to_remove_other_orders: function(order_id){
			this.pos.get('orders').chain()
            .map(function(new_order) {
                if (new_order.get_order_id()!=order_id){
                    new_order.set_removal_flag();
                }
            });
        },
        remove_orders: function(){
            /* REVERSING TO REMOVE, on_removed_order is having problems */
            for(var i = this.pos.get('orders').size() - 1, len = 0; i >= len; i--){
                if (this.pos.get('orders').at(i).to_be_removed){
                    this.pos.get('orders').at(i).destroy({'reason': 'abandon'});
                };
            };
        },

	});

	module.PosWidget = module.PosWidget.extend({
        build_widgets: function() {
            var self = this;
            this._super();

            this.pos.synchorders = new module.SynchOrders(this, {});
        },
    });

}