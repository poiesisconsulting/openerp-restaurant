function poi_extension_models(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;

    module.PosModel = module.PosModel.extend({
        // this is called when an order is removed from the order collection. It ensures that there is always an existing
        // order and a valid selected order
        on_removed_order: function(removed_order,index,reason){
            if( (reason === 'abandon' || removed_order.temporary) && this.get('orders').size() > 0){
                // when we intentionally remove an unfinished order, and there is another existing one
                removed_order.stop_synch();
                this.set({'selectedOrder' : this.get('orders').at(index) || this.get('orders').last()});
            }
            else{
                if (reason == 'synch'){
                    removed_order.stop_synch();
                }
                else{
                    // when the order was automatically removed after completion,
                    // or when we intentionally delete the only concurrent order
                    removed_order.stop_synch();
                    this.add_new_order();
                }
            }
        },
        build_order: function(order_id){
            instance.web.blockUI({ message: _t('Building order...')});
            var self = this;
            var order = false;
            var orderlines = false;

            var order_created = $.Deferred();

            $.when(self.get_order_sys(order_id)).then(function(orderrpc){
                instance.web.blockUI({ message: _t('Getting order from Database...')});
                order = orderrpc;
                return self.get_orderlines_sys(order.id);
            }).then(function(orderlinesrpc){
                instance.web.blockUI({ message: _t('Getting orderlines from Database...')});
                orderlines = orderlinesrpc;
            }).then(function(){
                instance.web.blockUI({ message: _t('Creating the new order...')});
                self.create_order(order, orderlines);
            }).then(function(){
                instance.web.blockUI({ message: _t('The Order has been successfully created...')});
                order_created.resolve();
                instance.web.unblockUI();
            });

            return order_created.promise();
        },
        create_order: function(order_data, orderlines_data){
            var self = this;

            var order=new module.Order({ pos: self });

            this.synchorders.assign_values_to_order(order, order_data);

            for(var j = 0, jlen = orderlines_data.length; j < jlen; j++){
                product=self.db.get_product_by_id(orderlines_data[j].product_id[0]);
                order.addProduct(product);
                last_orderline=order.getLastOrderline();
                self.synchorders.assign_values_to_orderline(last_orderline, orderlines_data[j]);
            };

            this.get('orders').add(order);
        	this.set('selectedOrder', order);
            order.start_synch();
        	return order;
        },
        get_order_sys: function(order_id){
            return this.synchorders.connection.rpc('/poi_pos_extension/get_order_data',{'order_id': order_id});
        },
        get_orderlines_sys: function(order_id){
            return this.synchorders.connection.rpc('/poi_pos_extension/get_orderline_data',{'order_id': order_id});
        },
        get_order_timestamp_sys: function(order_id){
            return this.synchorders.connection.rpc('/poi_pos_extension/get_orders_timestamp',{'order_ids': [order_id]});
        },
        get_orders_timestamp_sys: function(order_ids){
            return this.synchorders.connection.rpc('/poi_pos_extension/get_orders_timestamp',{'order_ids': order_ids});
        },
	    get_order_by_id: function(order_id){
            var self = this;
            order_res=false;
            this.get('orders').chain().map(
                function(order){
                if (order.get('order_id')==order_id){
                    order_res=order;
                };
            });
            return order_res;
        },
        get_order_data_by_id: function(order_id){
            var self = this;
            var order_data = {
                'order_created': false,
                'timestamp': 0
            }
            this.get('orders').chain().map(
                function(order){
                if (order.get('order_id')==order_id){
                    order_data = {
                        'order_created': true,
                        'timestamp': order.get_timestamp()
                    };
                };
            });
            return order_data;
        }
	});

	module.Orderline = module.Orderline.extend({
        has_changes_to_save: function()
        {
            var self = this;
            if (this.old_orderline_resume){
                if (JSON.stringify(this.export_as_JSON())==JSON.stringify(this.old_orderline_resume)){
                    return false;
                }
                else
                {
                    return true;
                }
            }
            return true;
        },
        save_changes: function(){
            var self = this;
            this.old_orderline_resume = this.export_as_JSON();
        },
		set_orderline_id: function(orderline_id){
			this.set({'orderline_id':orderline_id});
		},
		get_orderline_id: function(){
			if (this.get('orderline_id')) {
				return this.get('orderline_id');
			}
			else {
				return false;
			}
		},
		set_unique_name: function(unique_name){
			this.unique_name = unique_name;
		},
		get_unique_name: function(){
		    if (this.unique_name)
		    {
		        return this.unique_name;
		    }
		    else
		    {
		        this.unique_name = 'Orderline_'+this.generateUniqueId()+this.get_product().id;
		        return this.unique_name;
		    }
		},
		generateUniqueId: function() {
            return new Date().getTime();
        },
		set_timestamp: function(timestamp){
			this.set({'timestamp':timestamp});
		},
		get_timestamp: function(){
			if (this.get('timestamp')) {
				return this.get('timestamp');
			}
			else {
				return '';
			}
		},
		data_for_json: function() {
            return {
                qty: this.get_quantity(),
                price_unit: this.get_unit_price(),
                discount: this.get_discount(),
                product_id: this.get_product() && this.get_product().id || false,
                unique_name: this.get_unique_name(),
            };
        },
        //used to create a json of the ticket, to be sent to the printer
        data_for_printing: function(){
            return {
                quantity:           this.get_quantity(),
                unit_name:          this.get_unit().name,
                price:              this.get_unit_price(),
                discount:           this.get_discount(),
                product_name:       this.get_product().name,
                price_display :     this.get_display_price(),
                price_with_tax :    this.get_price_with_tax(),
                price_without_tax:  this.get_price_without_tax(),
                tax:                this.get_tax(),
                product_description:      this.get_product().description,
                product_description_sale: this.get_product().description_sale,
            };
        },
        exportforprinting_hook1: function(){
        	return {};
        },
        exportforprinting_hook2: function(){
        	return {};
        },
        exportforprinting_hook3: function(){
        	return {};
        },
        exportforprinting_hook4: function(){
        	return {};
        },
        exportforprinting_hook5: function(){
        	return {};
        },
        exportforprinting_hook6: function(){
        	return {};
        },
        exportforprinting_hook7: function(){
        	return {};
        },
        exportforprinting_hook8: function(){
        	return {};
        },
        exportforprinting_hook9: function(){
        	return {};
        },
        exportforprinting_hook10: function(){
        	return {};
        },
        exportasjson_hook1: function(){
        	return {};
        },
        exportasjson_hook2: function(){
        	return {};
        },
        exportasjson_hook3: function(){
        	return {};
        },
        exportasjson_hook4: function(){
        	return {};
        },
        exportasjson_hook5: function(){
        	return {};
        },
        exportasjson_hook6: function(){
        	return {};
        },
        exportasjson_hook7: function(){
        	return {};
        },
        exportasjson_hook8: function(){
        	return {};
        },
        exportasjson_hook9: function(){
        	return {};
        },
        exportasjson_hook10: function(){
        	return {};
        },
        export_as_JSON: function() {
        	tmp=this.data_for_json();
        	$.extend(tmp, this.exportasjson_hook1(),
        			this.exportasjson_hook2(),
        			this.exportasjson_hook3(),
        			this.exportasjson_hook4(),
        			this.exportasjson_hook5(),
        			this.exportasjson_hook6(),
        			this.exportasjson_hook7(),
        			this.exportasjson_hook8(),
        			this.exportasjson_hook9(),
        			this.exportasjson_hook10());
        	return tmp;
        },
        //used to create a json of the ticket, to be sent to the printer
        export_for_printing: function(){
        	tmp=this.data_for_printing();
        	$.extend(tmp, this.exportforprinting_hook1(),
        			this.exportforprinting_hook2(),
        			this.exportforprinting_hook3(),
        			this.exportforprinting_hook4(),
        			this.exportforprinting_hook5(),
        			this.exportforprinting_hook6(),
        			this.exportforprinting_hook7(),
        			this.exportforprinting_hook8(),
        			this.exportforprinting_hook9(),
        			this.exportforprinting_hook10());
        	return tmp;
        },
	});

	module.Paymentline = module.Paymentline.extend({
		//exports as JSON for server communication
        data_for_json: function(){
            return {
                name: instance.web.datetime_to_str(new Date()),
                statement_id: this.cashregister.id,
                account_id: this.cashregister.account_id[0],
                journal_id: this.cashregister.journal_id[0],
                amount: this.get_amount()
            };
        },
        //exports as JSON for receipt printing
        data_for_printing: function(){
            return {
                amount: this.get_amount(),
                journal: this.cashregister.journal_id[1],
            };
        },
        //Due several reasons I needed to create some hooks, each hook can be used only once, so please if you are going to use this... add
        //which module is going to use it as a comment to know that it's a busy hook
        exportforprinting_hook1: function(){
        	return {};
        },
        exportforprinting_hook2: function(){
        	return {};
        },
        exportforprinting_hook3: function(){
        	return {};
        },
        exportforprinting_hook4: function(){
        	return {};
        },
        exportforprinting_hook5: function(){
        	return {};
        },
        exportforprinting_hook6: function(){
        	return {};
        },
        exportforprinting_hook7: function(){
        	return {};
        },
        exportforprinting_hook8: function(){
        	return {};
        },
        exportforprinting_hook9: function(){
        	return {};
        },
        exportforprinting_hook10: function(){
        	return {};
        },
        exportasjson_hook1: function(){
        	return {};
        },
        exportasjson_hook2: function(){
        	return {};
        },
        exportasjson_hook3: function(){
        	return {};
        },
        exportasjson_hook4: function(){
        	return {};
        },
        exportasjson_hook5: function(){
        	return {};
        },
        exportasjson_hook6: function(){
        	return {};
        },
        exportasjson_hook7: function(){
        	return {};
        },
        exportasjson_hook8: function(){
        	return {};
        },
        exportasjson_hook9: function(){
        	return {};
        },
        exportasjson_hook10: function(){
        	return {};
        },
        //exports as JSON for server communication
        export_as_JSON: function(){
        	tmp=this.data_for_json();
        	$.extend(tmp, this.exportasjson_hook1(),
        			this.exportasjson_hook2(),
        			this.exportasjson_hook3(),
        			this.exportasjson_hook4(),
        			this.exportasjson_hook5(),
        			this.exportasjson_hook6(),
        			this.exportasjson_hook7(),
        			this.exportasjson_hook8(),
        			this.exportasjson_hook9(),
        			this.exportasjson_hook10());
        	return tmp;
        },
        //exports as JSON for receipt printing
        export_for_printing: function(){
            tmp=this.data_for_printing();

            $.extend(tmp, this.exportforprinting_hook1(),
        			this.exportforprinting_hook2(),
        			this.exportforprinting_hook3(),
        			this.exportforprinting_hook4(),
        			this.exportforprinting_hook5(),
        			this.exportforprinting_hook6(),
        			this.exportforprinting_hook7(),
        			this.exportforprinting_hook8(),
        			this.exportforprinting_hook9(),
        			this.exportforprinting_hook10());

        	return tmp;
        },
	});


	module.Order = module.Order.extend({
        /*
        This function intends to save all the orderlines, but we're not going to call this function from this module
        because this is a generic addon. This function needs to be called when the dependent addon wants to save all
        the orderline data on the db.
         */
        save_orderlines: function(){
            var self = this;
            if (this.get_order_id()){
                var orderlines = this.get('orderLines').models;
                for(var i = 0; i < orderlines.length; i++){
                    if (orderlines[i].has_changes_to_save()){
                        (new instance.web.Model('pos.order')).get_func('save_orderline_from_ui')(self.get_order_id(), [orderlines[i].export_as_JSON()]).then(function(){
                            orderlines[i].save_changes();
                        });
                    }
                }
            }
        },
        start_synch: function(){
            var self = this;
            if (this.get_order_id())
            {
                this.pos.synched_orders.push(this.get_order_id());
            }

            function synch_order(){
                if (self.get_order_id())
                {
                    $.when(self.pos.get_order_timestamp_sys(self.get_order_id())).then(function(order_timestamp){
                        if (order_timestamp[self.get_order_id()] > self.get_timestamp()){
                            self.compare_order();
                        };
                    }).always(function(){
                        if ($.inArray(self.get_order_id(),self.pos.synched_orders) >= 0){
                            setTimeout(synch_order,5000);
                        }
                    })
                }
            }
            synch_order();

        },
        stop_synch: function(){
            var self = this;
            this.pos.synched_orders.splice($.inArray(self.get_order_id(), this.pos.synched_orders),1);
        },
        compare_order: function(){
            var self = this;
            var order = false;
            var orderlines = false;

            $.when(self.pos.get_order_sys(self.get_order_id())).then(function(orderrpc){
                order = orderrpc;
                self.pos.synchorders.compare_order_data(self,order);
                return self.pos.get_orderlines_sys(order.id);
            }).then(function(orderlinesrpc){

                orderlinesrpc_un = []

                for(var i = 0; i < orderlinesrpc.length; i++){
                    orderline_sys = self.get_orderline_by_unique_name(orderlinesrpc[i].unique_name)
                    //Si se encontro dentro del sistema, hay que modificarlo, sino agregarlo
                    if (orderline_sys){
                         self.pos.synchorders.compare_orderline_data(orderline_sys,orderlinesrpc[i]);
                    }
                    else
                    {
                        self.pos.synchorders.add_new_orderline(self,orderlinesrpc[i]);
                    }
                    orderlinesrpc_un.push(orderlinesrpc[i].unique_name);
                }
                orderlines = orderlinesrpc;

                unique_names = self.get_orderlines_unique_names();
                for(var j = 0; j < unique_names.length; j++){
                    if($.inArray(unique_names[j],orderlinesrpc_un)<0)
                    {
                        line_to_remove = self.get_orderline_by_unique_name(unique_names[j])
                        self.removeOrderline(line_to_remove);
                    }
                }
            });
        },
	    set_order_id: function(order_id){
			this.set({'order_id':order_id});
		},
		get_order_id: function(){
			if (this.get('order_id')) {
				return this.get('order_id');
			}
			else {
				return false;
			}
		},
		set_timestamp: function(timestamp){
			this.set({'timestamp':timestamp});
		},
		get_timestamp: function(){
			if (this.get('timestamp')) {
				return this.get('timestamp');
			}
			else {
				return '';
			}
		},
		set_removal_flag: function(){
		    this.to_be_removed = true;
		},
        get_orderline_by_unique_name: function(unique_name){
            orderline_selected = false;
            this.get('orderLines').each(function(orderline){
                if (orderline.unique_name == unique_name){
                    orderline_selected = orderline;
                }
            });
            return orderline_selected;
        },
        get_orderlines_unique_names: function(){
            orderlines_un = [];
            this.get('orderLines').each(function(orderline){
                orderlines_un.push(orderline.unique_name);
            });
            return orderlines_un;
        },

		//Data for printing is needed to inherit and change the data for export_for_printing
        data_for_printing: function () {
            var orderlines = [];
            this.get('orderLines').each(function (orderline) {
                orderlines.push(orderline.export_for_printing());
            });
            var paymentlines = [];
            this.get('paymentLines').each(function (paymentline) {
                paymentlines.push(paymentline.export_for_printing());
            });
            var client = this.get('client');
            var cashier = this.pos.cashier || this.pos.user;
            var company = this.pos.company;
            var shop = this.pos.shop;
            var date = new Date();


            return {
                orderlines: orderlines,
                paymentlines: paymentlines,
                subtotal: this.getSubtotal(),
                total_with_tax: this.getTotalTaxIncluded(),
                total_without_tax: this.getTotalTaxExcluded(),
                total_tax: this.getTax(),
                total_paid: this.getPaidTotal(),
                total_discount: this.getDiscountTotal(),
                tax_details: this.getTaxDetails(),
                change: this.getChange(),
                name: this.getName(),
                client: client ? client.name : null,
                invoice_id: null, //TODO
                cashier: cashier ? cashier.name : null,
                header: this.pos.config.receipt_header || '',
                footer: this.pos.config.receipt_footer || '',
                precision: {
                    price: 2,
                    money: 2,
                    quantity: 3,
                },
                date: {
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    date: date.getDate(), // day of the month
                    day: date.getDay(), // day of the week
                    hour: date.getHours(),
                    minute: date.getMinutes(),
                    isostring: date.toISOString(),
                },
                company: {
                    email: company.email,
                    website: company.website,
                    company_registry: company.company_registry,
                    contact_address: company.partner_id[1],
                    vat: company.vat,
                    name: company.name,
                    phone: company.phone,
                    logo: this.pos.company_logo_base64,
                },
                shop: {
                    name: shop.name,
                },
                currency: this.pos.currency,
            };

        },
		//data for JSON collects the data for exportAsJSON
		data_for_json: function() {
			var orderLines, paymentLines;
            orderLines = [];
            (this.get('orderLines')).each(_.bind( function(item) {
                return orderLines.push([0, 0, item.export_as_JSON()]);
            }, this));
            paymentLines = [];
            (this.get('paymentLines')).each(_.bind( function(item) {
                return paymentLines.push([0, 0, item.export_as_JSON()]);
            }, this));
            return {
                name: this.getName(),
                amount_paid: this.getPaidTotal(),
                amount_total: this.getTotalTaxIncluded(),
                amount_tax: this.getTax(),
                amount_return: this.getChange(),
                lines: orderLines,
                statement_ids: paymentLines,
                pos_session_id: this.pos.pos_session.id,
                partner_id: this.get_client() ? this.get_client().id : false,
                user_id: this.pos.cashier ? this.pos.cashier.id : this.pos.user.id,
                uid: this.uid,
            };
        },
        //Due several reasons I needed to create some hooks, each hook can be used only once, so please if you are going to use this... add
        //which module is going to use it as a comment to know that it's a busy hook
        exportforprinting_hook1: function(){
            //poi_pos_table_designer
        	return {};
        },
        exportforprinting_hook2: function(){
            //poi_restaurant
        	return {};
        },
        exportforprinting_hook3: function(){
        	return {};
        },
        exportforprinting_hook4: function(){
        	return {};
        },
        exportforprinting_hook5: function(){
        	return {};
        },
        exportforprinting_hook6: function(){
        	return {};
        },
        exportforprinting_hook7: function(){
        	return {};
        },
        exportforprinting_hook8: function(){
        	return {};
        },
        exportforprinting_hook9: function(){
        	return {};
        },
        exportforprinting_hook10: function(){
        	return {};
        },
        exportasjson_hook1: function(){
        	return {};
        },
        exportasjson_hook2: function(){
        	return {};
        },
        exportasjson_hook3: function(){
        	return {};
        },
        exportasjson_hook4: function(){
        	return {};
        },
        exportasjson_hook5: function(){
        	return {};
        },
        exportasjson_hook6: function(){
        	return {};
        },
        exportasjson_hook7: function(){
        	return {};
        },
        exportasjson_hook8: function(){
        	return {};
        },
        exportasjson_hook9: function(){
        	return {};
        },
        exportasjson_hook10: function(){
        	return {};
        },
        //Calls the method data_for_printing


        export_for_printing: function(){
        	var tmp=this.data_for_printing();
        	$.extend(tmp, this.exportforprinting_hook1(),
        			this.exportforprinting_hook2(),
        			this.exportforprinting_hook3(),
        			this.exportforprinting_hook4(),
        			this.exportforprinting_hook5(),
        			this.exportforprinting_hook6(),
        			this.exportforprinting_hook7(),
        			this.exportforprinting_hook8(),
        			this.exportforprinting_hook9(),
        			this.exportforprinting_hook10());

        	return tmp;

        },

        export_as_JSON: function(){
        	var tmp=this.data_for_json();
        	$.extend(tmp, this.exportasjson_hook1(),
        			this.exportasjson_hook2(),
        			this.exportasjson_hook3(),
        			this.exportasjson_hook4(),
        			this.exportasjson_hook5(),
        			this.exportasjson_hook6(),
        			this.exportasjson_hook7(),
        			this.exportasjson_hook8(),
        			this.exportasjson_hook9(),
        			this.exportasjson_hook10());
        	return tmp;
        },

        restart_hooks: function (){
        	this.already_executed = false;
        	this.hook1_ready = $.Deferred();
			this.hook2_ready = $.Deferred();
			this.hook3_ready = $.Deferred();
			this.hook4_ready = $.Deferred();
			this.hook5_ready = $.Deferred();
			this.hook6_ready = $.Deferred();
			this.hook7_ready = $.Deferred();
			this.hook8_ready = $.Deferred();
			this.hook9_ready = $.Deferred();
			this.hook10_ready = $.Deferred();
        },


	});

}