function poi_extension_screens(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;

	module.ScreenSelector = module.ScreenSelector.extend({
	    show_popup_overall: function(name){
            if(this.current_popup_overall){
                this.close_popup_overall();
            }
            this.current_popup_overall = this.popup_set[name];
            this.current_popup_overall.show();
        },
        close_popup_overall: function(){
            if(this.current_popup_overall){
                this.current_popup_overall.close();
                this.current_popup_overall.hide();
                this.current_popup_overall = null;
            }
        },
		//Adds a popup. It's based on add_screen. Hope it works
		add_popup: function(popup_name, popup){
			popup.hide();
            this.popup_set[popup_name] = popup;
            return this;
        },
        set_current_screen_no_close_popup: function(screen_name,params,refresh){
            var screen = this.screen_set[screen_name];
            if(!screen){
                console.error("ERROR: set_current_screen("+screen_name+") : screen not found");
            }

            var selectedOrder = this.pos.get('selectedOrder');
            if(this.current_mode === 'client'){
                selectedOrder.set_screen_data('client_screen',screen_name);
                if(params){
                    selectedOrder.set_screen_data('client_screen_params',params);
                }
            }else{
                selectedOrder.set_screen_data('cashier_screen',screen_name);
                if(params){
                    selectedOrder.set_screen_data('cashier_screen_params',params);
                }
            }

            if(screen && (refresh || screen !== this.current_screen)){
                if(this.current_screen){
                    this.current_screen.close();
                    this.current_screen.hide();
                }
                this.current_screen = screen;
                this.current_screen.show();
            }
        }
	});




    module.OrderSelectorScreenWidget = module.ScreenWidget.extend({
        template: 'OrderSelectorScreenWidget',

        show_leftpane:   false,
        previous_screen: 'products',
        init: function(parent,options){
            this.order_list_ids = [];
            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            this.synch_domain = [];
            this.orders_collection = [];
            this._super(parent,options);
        },
        connect: function(){
            var self = this;

            function reload_order_list(){
                $.when(self.fetch_ids(self.synch_domain,{})).then(function(orders){
                    compare_result = self.compare_order_list(orders);

                    order_ids = [];

                    for (var k=0; k < orders.length; k++)
                    {
                        order_ids.push(orders[k].id)
                    }

                    self.order_list_ids = order_ids;
                    return compare_result;
                }).then(function(compare_result){
                    if (compare_result.to_add.length>0){
                        for(var i = 0; i < compare_result.to_add.length; i++){
                            if (!self.find_order_button(compare_result.to_add[i]))
                            {
                                self.add_order_button(compare_result.to_add[i]);
                            }
                        }
                    }
                    if (compare_result.to_remove.length>0){
                        for(var j = 0; j < compare_result.to_remove.length; j++){
                            self.remove_order_button(compare_result.to_remove[j]);
                        }
                    }
                }).always(function(){
                    setTimeout(reload_order_list,5000);
                });
            };
            reload_order_list();
        },
        compare_order_list: function(new_order_list){

            var self = this;

            order_ids = [];
            for (var k=0; k < new_order_list.length; k++)
            {
                order_ids.push(new_order_list[k].id)
            }
            new_order_list_ids = order_ids;

            var result = {
                'to_add': [],
                'to_remove': [],
            }

            orders_to_check_update = [];

            if (new_order_list_ids){
                var old_order_list = this.order_list_ids;
                for(var i = 0; i < new_order_list_ids.length; i++){
                    if ($.inArray(new_order_list_ids[i],old_order_list) < 0)
                    {
                        result.to_add.push(new_order_list_ids[i]);
                    }
                    else
                    {
                        orders_to_check_update.push(new_order_list_ids[i]);
                    }
                }
                for(var i = 0; i < old_order_list.length; i++){
                    if ($.inArray(old_order_list[i],new_order_list_ids) < 0)
                    {
                        result.to_remove.push(old_order_list[i]);
                    }
                }

            }

            if (orders_to_check_update){
                for(var i = 0; i < orders_to_check_update.length; i++){
                    order_button = self.find_order_button(orders_to_check_update[i]);
                    new_timestamp = 0;
                    for (var k=0; k < new_order_list.length; k++)
                    {
                        if (new_order_list[k].id==orders_to_check_update[i])
                        {
                            new_timestamp=new_order_list[k].timestamp;
                        }
                    }
                    if (order_button.order != undefined) {
                        if (new_timestamp >= order_button.order.timestamp)
                        {
                            self.update_order_button(orders_to_check_update[i]);
                        }
                    }

                }
            }
            return result;
        },
        fetch_ids: function(domain, context){
            var result = [];
            context = context || {};
            return this.connection.rpc('/poi_pos_extension/get_order_ids',{'domain': domain, 'context': context}).then(function(res){
                return res.orders;
            });
        },
        add_order_button: function(order_id){
            var self = this;
            this.pos.get_order_sys(order_id).then(function(order_data){
                var new_order_button = new module.OrderSelectorButtonWidget(null, {
                    order: order_data,
                    pos: self.pos
                });
                self.orders_collection.push(new_order_button);
                new_order_button.appendTo(self.$('.order-list'));
            })

        },
        update_order_button: function(order_id){
            var self = this;
            this.pos.get_order_sys(order_id).then(function(order_data){
                order_button = self.find_order_button(order_id);
                order_button.refresh_button(order_data);
            })

        },
        remove_order_button: function(order_id){
            item=this.find_order_button(order_id);
            position = $.inArray(item,this.orders_collection);
            this.orders_collection.splice(position,1);
            item.destroy();
            /*
            if (item){
                item.parent().hide("puff", {}, 1000, function() {
                    $(this).remove();
                });
            }*/
        },
        find_order_button: function(order_id){
            var self = this;
            for (var i = 0; i < this.orders_collection.length; i++)
            {
                if (self.orders_collection[i].order.id == order_id){
                    return self.orders_collection[i];
                }
            }
            return false;
        },
        renderElement: function(){
            var self = this;
            this._super();
            for(var i = 0; i < this.order_list_ids.length; i++){
                if (self.find_order_button(this.order_list_ids[i]).length==0)
                {
                    self.add_order_button(this.order_list_ids[i]);
                }
            }
            /*
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
            });*/
        },
        show: function(){
            var self = this;
            this._super();
            //this.renderElement();
        },
        set_domain: function(domain){
            this.synch_domain=domain;
        },
    });

    module.OrderSelectorButtonWidget = module.PosBaseWidget.extend({
        template:'OrderSelectorButtonWidget',
        init: function(parent, options) {
            this._super(parent,options);
            //var self = this;

            this.order = options.order;
            //this.order.bind('destroy',this.destroy, this );
            //this.order.bind('change', this.renderElement, this );
            //this.pos.bind('change:selectedOrder', this.renderElement,this );
        },
        refresh_button: function(order){
            this.order = order;
            this.renderElement();
        },
        renderElement:function(){
            //this.selected = ( this.pos.get('selectedOrder') === this.order )
            this._super();
            var self = this;
            this.$el.click(function(){
                self.selectOrder(self.order.id);
            });
            /*
            this.$el.click(function(){
                if( self.pos.get('selectedOrder') === self.order ){
                    var ss = self.pos.pos_widget.screen_selector;
                    if(ss.get_current_screen() === 'clientlist'){
                        ss.back();
                    }else{
                        ss.set_current_screen('clientlist');
                    }
                }else{
                    self.selectOrder();
                }
            });
            if( this.selected){
                this.$el.addClass('selected');
            }
            */
        },
        selectOrder: function(order_id) {
            var self = this;
            //This intends to avoid miscreation
            order_data = self.pos.get_order_data_by_id(order_id);
            if (order_data.order_created)
            {
                order = self.pos.get_order_by_id(order_id);
                actual_screen = order.get_screen_data('screen');

                self.pos.set('selectedOrder', order);

                var ss = self.pos.pos_widget.screen_selector;
                if (actual_screen){
                    ss.set_current_screen(actual_screen);
                }
                else{
                    ss.set_current_screen('products');
                }

            }
            else
            {
                self.pos.build_order(order_id).done(function(){
                    self.on_order_built(order_id);
                });
            }
            /*this.pos.set({
                selectedOrder: this.order
            });*/
        },
        on_order_built: function(order_id){
           // console.log('YA SE CREO LA ORDEN', order_id);
        },
        destroy: function(){
            /*
            this.order.unbind('destroy', this.destroy, this);
            this.order.unbind('change',  this.renderElement, this);
            this.pos.unbind('change:selectedOrder', this.renderElement, this);
            */
            var self = this;
            //This intends to avoid miscreation
            order_data = self.pos.get_order_data_by_id(self.order.id);
            if (order_data.order_created)
            {
                order = self.pos.get_order_by_id(self.order.id);
                order.destroy({'reason':'synch'});
            }
            this._super();
        },
    });

    module.PaymentScreenWidget = module.PaymentScreenWidget.extend({
        // Overriding this function to create a prevalidate_order
        prevalidate_order: function(){
            var self = this;
            //Every function that overrides this must change validated to false before true validation
            //ToDo: Check if every function must check if it's true, if it's false nothing can chenge it to true?
            this.validated = true;
        },
        validate_order: function(options) {
            var self = this;
            this.validated = false;
            var realvalidate = this._super;

            $.when(self.prevalidate_order()).then(function(){
                if (self.validated){
                    realvalidate.call(self);
                }
                else{
                    console.log('IS NOT VALIDATED');
                    return;
                }

            });
        },
    });

    module.OrderWidget = module.OrderWidget.extend({
        change_selected_order: function() {
            this.unbind_all_orderline_events();
            this.bind_orderline_events();
            this.renderElement();
        },
        unbind_all_orderline_events: function(){
            this.pos.get('orders').chain().map(
                function(order){
                    order.get('orderLines').unbind();
                });
        },
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            this.order_selector_screen = new module.OrderSelectorScreenWidget(this,{});
            this.order_selector_screen.appendTo(this.$('.screens'));
            this.screen_selector.add_screen('order_selector_screen',this.order_selector_screen);

            var show_order_selector = $(QWeb.render('ShowOrdersButton'));

            show_order_selector.click(function(){
                self.pos_widget.screen_selector.set_current_screen_no_close_popup('order_selector_screen');
            });

            show_order_selector.prependTo(this.$('.order-selector'));

        }
    });




}