function poi_pos_models(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;

	module.PosModel = module.PosModel.extend({
	    //Note: This function returns an array with table ids assigned to user_id
        get_user_table_ids: function(user_id){
            table_ids=[];
            _.each(this.tables_list, function(table){
                if ($.inArray(user_id,table.users_ids)>=0){
                    table_ids.push(table.id);
                }
            });
            return table_ids;
        },
        //Note: This function returns an array with table objects assigned to user_id
        get_user_tables: function(user_id){
            tables=[];
            _.each(this.tables_list, function(table){
                if ($.inArray(user_id,table.users_ids)>=0){
                    tables.push(table);
                }
            });
            return tables;
        },
        //Note: This function returns an array with table ids assigned to user_id for some specific area_id
        get_user_table_ids_from_area: function(user_id, area_id){
            table_ids=[];
            _.each(this.tables_list, function(table){
                if ($.inArray(user_id,table.users_ids)>=0){
                    if (table.area_id){
                        if (table.area_id[0]==area_id){
                            table_ids.push(table.id);
                        }
                    }
                }
            });
            return table_ids;
        },
        //Note: This function returns an array with table objects assigned to user_id for some specific area_id
        get_user_tables_from_area: function(user_id, area_id){
            tables=[];
            _.each(this.tables_list, function(table){
                if ($.inArray(user_id,table.users_ids)>=0){
                    if (table.area_id){
                        if (table.area_id[0]==area_id){
                            tables.push(table);
                        }
                    }
                }
            });
            return tables;
        },
        //Note: This function returns an array with table objects for some specific area_id
        get_all_tables_from_area: function(area_id){
            tables=[];
            _.each(this.tables_list, function(table){
                if (table.area_id){
                    if (table.area_id[0]==area_id){
                        tables.push(table);
                    }
                }
            });
            return tables;
        },
        //Note: This function returns an array with table objects
        get_all_tables: function(area_id){
            tables=[];
            _.each(this.tables_list, function(table){
                tables.push(table);
            });
            return tables;
        },
        get_area_name: function(area_id){
            area_name = '';
            _.each(this.areas_list, function(area){
                if (area.id == area_id){
                    area_name = area.name;
                }
            });
            return area_name;
        },
        get_table_code: function(table_id){
            table_code = '';
            _.each(this.tables_list, function(table){
                if (table.id == table_id){
                    table_code = table.code;
                }
            });
            return table_code;
        },
        get_table_area: function(table_id){
            table_area = false;
            _.each(this.tables_list, function(table){
                if (table.id == table_id){
                    table_area = table.area_id[0];
                }
            });
            return table_area;
        },
        get_tables_code: function(table_ids){
            table_codes = [];

            for(var i = 0; i < table_ids.length; i++){
                table_codes.push(this.get_table_code(table_ids[i]));
            }
            return table_codes;
        },
        get_areas_name: function(area_ids){
            area_names = [];

            for(var i = 0; i < area_ids.length; i++){
                area_names.push(this.get_area_name(area_ids[i]));
            }
            return area_names;
        },
        get_tables_area_name: function(table_ids){
            areas = [];

            for(var i = 0; i < table_ids.length; i++){
                areas.push(this.get_table_area(table_ids[i]));
            }

            var area_ids = [];
            $.each(areas, function(i, el){
                if($.inArray(el, area_ids) === -1) area_ids.push(el);
            });

            area_names = this.get_areas_name(area_ids);

            return area_names;
        },
        /*
        *The following functions are created to reload all the orders that are is draft state.
        *It needs POS Manager permission, maybe another else permission
        *because that order in draft is considered as a order, maybe already served.
        *Only the manager is able to delete orderlines
        */
        reload_user_tables: function(user_id){
            this.reload_table_orders(this.get_user_table_ids(user_id));
        },
        reload_table_orders: function(tables){
            this.synchorders.set_domain([['state','=','draft'],['table_ids','in',tables]]);
            this.pos_widget.order_selector_screen.set_domain([['state','=','draft'],['table_ids','in',tables]]);
        },
        push_order: function(order) {
            order.set_order_tables_state('open');   //'paid' configurable?
            var self = this;
            this.proxy.log('push_order',order.export_as_JSON());
            var order_id = this.db.add_order(order.export_as_JSON());
            var pushed = new $.Deferred();

            this.set('synch',{state:'connecting', pending:self.db.get_orders().length});

            this.flush_mutex.exec(function(){
                var flushed = self._flush_all_orders();

                flushed.always(function(){
                    pushed.resolve();
                });

                return flushed;
            });
            return pushed;
        },

        // saves the order locally and try to send it to the backend and make an invoice
        // returns a deferred that succeeds when the order has been posted and successfully generated
        // an invoice. This method can fail in various ways:
        // error-no-client: the order must have an associated partner_id. You can retry to make an invoice once
        //     this error is solved
        // error-transfer: there was a connection error during the transfer. You can retry to make the invoice once
        //     the network connection is up

        push_and_invoice_order: function(order){
            //Added this
            order.set_order_tables_state('open');   //'paid' configurable?
            var self = this;
            var invoiced = new $.Deferred();

            if(!order.get_client()){
                invoiced.reject('error-no-client');
                return invoiced;
            }

            var order_id = this.db.add_order(order.export_as_JSON());

            this.set('synch',{state:'connecting', pending:self.db.get_orders().length});

            this.flush_mutex.exec(function(){
                var done = new $.Deferred(); // holds the mutex

                // send the order to the server
                // we have a 30 seconds timeout on this push.
                // FIXME: if the server takes more than 30 seconds to accept the order,
                // the client will believe it wasn't successfully sent, and very bad
                // things will happen as a duplicate will be sent next time
                // so we must make sure the server detects and ignores duplicated orders

                var transfer = self._flush_order(order_id, {timeout:30000, to_invoice:true});

                transfer.fail(function(){
                    invoiced.reject('error-transfer');
                    done.reject();
                });

                // on success, get the order id generated by the server
                transfer.pipe(function(order_server_id){
                    // generate the pdf and download it
                    self.pos_widget.do_action('point_of_sale.pos_invoice_report',{additional_context:{
                        active_ids:order_server_id,
                    }});
                    invoiced.resolve();
                    done.resolve();
                });

                return done;

            });

            return invoiced;
        },
        _save_to_server: function (orders, options) {
            if (!orders || !orders.length) {
                var result = $.Deferred();
                result.resolve();
                return result;
            }

            options = options || {};

            var self = this;
            var timeout = typeof options.timeout === 'number' ? options.timeout : 30000 * orders.length;

            // we try to send the order. shadow prevents a spinner if it takes too long. (unless we are sending an invoice,
            // then we want to notify the user that we are waiting on something )
            var posOrderModel = new instance.web.Model('pos.order');
            return posOrderModel.call('create_from_ui',
                [_.map(orders, function (order) {
                    order.to_invoice = options.to_invoice || false;
                    return order;
                })],
                undefined,
                {
                    shadow: !options.to_invoice,
                    timeout: timeout
                }
            ).then(function () {
                _.each(orders, function (order) {
                    self.db.remove_order(order.id);
                });
            }).fail(function (unused, event){
                // prevent an error popup creation by the rpc failure
                // we want the failure to be silent as we send the orders in the background
                event.preventDefault();
                console.error('Failed to send orders:', orders);
            });
        },
    });

	module.Orderline = module.Orderline.extend({
        get_order_line_state_id: function(){
            state_id = this.order_line_state_id;
            if (state_id)
            {
                return state_id;
            }
            else
            {
                return false;
            }
        },
        set_order_line_state_id: function(state){
            this.order_line_state_id = state;
            this.trigger('change', this);
        },
        get_is_lady: function(){
            if (this.is_lady)
            {
                return true;
            }
            else
            {
                return false;
            }
	    },
	    set_is_lady: function(is_lady){
	        this.is_lady = is_lady;

            this.trigger('change', this);
	    },
        get_sent_to_kitchen: function(){
            if (this.sent_to_kitchen)
            {
                return true;
            }
            else
            {
                return false;
            }
	    },
	    set_sent_to_kitchen: function(flag){
	        if (flag == true)
	            this.sent_to_kitchen = true;
	        else
	            this.sent_to_kitchen = false;

            this.trigger('change', this);
	    },

        get_product_ids: function(){
            result=[]
            _.each(this.product_ids, function(prod_id) {
                if (typeof(prod_id)=="object") {
                    result.push([0,0,{  'product_id': parseInt(prod_id[2].product_id),
                                        'property_id': parseInt(prod_id[2].property_id)
                                    }]);
                }
                else {
                    if (prod_id && prod_id.split('_').length >= 2) {
                        result.push([0,0,{  'product_id': parseInt(prod_id.split('_')[1]),
                                            'property_id': parseInt(prod_id.split('_')[0])
                                        }]);
                    }
                }

            });
            return result;
        },

        set_product_ids: function(product_ids){
            this.product_ids = product_ids;
            this.trigger('change', this);
        },
        get_product_ids_from_db: function(){
            if (this.props_prods){
                return this.props_prods;
            }
            else
            {
                return false;
            }
        },
        set_product_ids_from_db: function(table_ids){
            this.props_prods = table_ids;
            var product_ids=[];
            var self = this;
			self.pos.fetch(
                    'product.product.property.id',
                    ['property_id','product_id'],
                    [['id', 'in', table_ids]]
                ).then(function(props_prods){
                    _.each(props_prods, function(prop_prod){
                       product_ids.push(prop_prod.property_id[0]+'_'+prop_prod.product_id[0]);
                    });
                    self.set_product_ids(product_ids);
                });
            //return product_ids;
        },

        get_property_desc: function(){
        	return this.property_description;
        },
        set_property_desc: function(desc){
        	this.property_description = desc;
        	this.trigger('change', this);
        },

        get_notes: function(){
        	return this.order_line_notes;
        },
        set_notes: function(notes){
            this.order_line_notes = notes;
            this.trigger('change', this);
        },

        get_product_category: function(){
        	return this.product.attributes.pos_categ_id[0]
        },

        get_print_qty : function(){
        	return this.print_qty;
        },

        get_wifi_print_qty : function(){
        	return this.print_wifi_qty;
        },
        // sets the id of the seat
        set_seat: function(seat){
            this.seatStr = '' + seat;
            this.trigger('change',this);
        },
        // returns the seat
        get_seat: function(){
            //Seat by default
            if (!this.seatStr){
                this.seatStr='1';
            }
            else if (this.seatStr=='0')
            {
                return 'ALL';
            }
            return this.seatStr;
        },
        // sets the sequence
        set_sequence: function(sequence){
            this.sequenceStr = '' + sequence;
            this.trigger('change',this);
        },
        // returns the seat as string
        get_sequence: function(){
            //Sequence by default
            if (!this.sequenceStr){
                if (this.product.course_sequence) {
                    this.sequenceStr='' + this.product.course_sequence;
                }
                else {
                    var current_course = this.pos.get('selectedOrder').get_current_course();
                    if (current_course) {
                        this.sequenceStr='' + current_course;
                    } else {
                        this.sequenceStr= '1';
                    }
                }
            }
            return this.sequenceStr;
        },
        exportasjson_hook1: function(){
        	return {
                product_ids: this.get_product_ids(),
                property_description: this.get_property_desc(),
                order_line_notes: this.get_notes(),
                seat: parseInt(this.seatStr),
                sequence: this.get_sequence(),
                id: this.get_orderline_id(),
                lady: this.get_is_lady(),
            };
        },
        exportforprinting_hook1: function(){
            return {
            	product_ids: this.get_product_ids(),
                property_description: this.get_property_desc(),
                order_line_notes: this.get_notes(),
                seat: parseInt(this.seatStr),
                sequence: this.get_sequence(),
                lady: this.get_is_lady(),
            };
        },
    });


    module.Order = module.Order.extend({

        everything_on_kitchen: function(){
            var result = true;
            var orderlines = this.get('orderLines').models;
            for(var i = 0; i < orderlines.length; i++){
                if(!orderlines[i].get_orderline_id()){
                    result = false;
                    break;
                }
            }
            return result;
        },
        save_lines_on_db: function(){
            var currentOrder = this;
            var lines = currentOrder.attributes.orderLines.models;
            var order_saved = $.Deferred();
            if(lines == ''){
                //console.log('THERE ARE NO LINES TO BE SENT');
            }
            else{
                (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function(order_id){
                    currentOrder.attributes.id = order_id[0];
                    for( idx in lines ){
                        lines[idx].id = order_id[1][idx];
                    }
                    //currentOrder.set_order_tables_state('order_taken');
                    //alert('Order sent to kitchen successfully!');
                }).then(function(){
                    order_saved.resolve();
                });
            }

            return order_saved.promise();
        },


        get_all_lines: function(){
            return this.attributes.orderLines.models;
        },

        get_all_lines_sorted: function(){
            var lines = this.attributes.orderLines.models;

            return SortLines(lines);

            function SortLines(lines_to_sort){

                /*//sort by seat
                lines_to_sort.sort(function(a, b){
                    var a1 = a.seatStr, b1 = b.seatStr;
                    if(a1 == b1) return 0;
                    return a1 > b1? 1 : -1;
                });*/

                //sort by sequence (course)
                lines_to_sort.sort(function(a, b){
                    var a1 = a.sequenceStr, b1 = b.sequenceStr;
                    if(a1 == b1) return 0;
                    return a1 > b1? 1 : -1;
                });

                return lines_to_sort;
            }
        },

		addProduct: function(product, options){

            options = options || {};

            var line = new module.Orderline({}, {   pos: this.pos,
                                                    order: this,
                                                    product: product,
                                                });

            line.set_sent_to_kitchen(false);

            if (options.discount !== undefined){
                line.set_discount(options.discount);
            }

            if (options.product_ids !== undefined){
                line.set_product_ids(options.product_ids);
            }

            if (options.descrip !== undefined){
                line.set_property_desc(options.descrip);
            }

            if (options.order_line_notes !== undefined){
                line.set_notes(options.order_line_notes);
            }

            if (options.quantity !== undefined){
                line.set_quantity(options.quantity);
            }

            if (options.price !== undefined){
                line.set_unit_price(options.price);
            }

            if (options.seat !== undefined){
                line.set_seat(options.seat);
            }

            if (options.course !== undefined){
                line.set_sequence(options.course);
            }

            this.get('orderLines').add(line);
            this.selectLine(line); //make this new line the "Selected Line"

        },
        exportforprinting_hook1: function(){
            return {
                total_with_tax: this.getTotalTaxIncluded(),
                kitchen_receipt : this.pos.kitchen_receipt ? true : false,
            }
        },

        exportasjson_hook1: function() {
            return {
                table_ids: this.get_tables(),
                order_id: this.get_order_id() ? this.get_order_id() : null,
                number_of_seats: this.get_seats(),
                covers: this.get_covers(),
                courses: this.get_courses(),
                internal_message: this.geT_internal_message()
            };
        },

        get_covers: function(){
            var seats = [];
            var covers =[];
            (this.get('orderLines')).each(_.bind( function(item) {
                return seats.push(item.get_seat());
            }, this));
            if (seats.length>0)
            {
                covers = $.unique(seats);
                if ($.inArray('ALL', covers)>=0){
                    covers.splice( $.inArray('ALL', covers), 1 );
                }
            }
            return covers.length;
        },

        set_courses: function(courses){
            this.set({'courses': courses});
        },

        get_courses: function(){
            if (this.get('courses'))
                return this.get('courses');
            else
                return 1;
        },

        set_current_course: function(course){
            this.set({'current_course': course});
        },

        get_current_course: function(){
            if (this.get('current_course')) {
                return this.get('current_course');
            }
            else {
               // this.set({'current_course': 1});
                return 1;
            }
        },

        set_fired_courses_no_synch: function(f_course){

            var current_time = new Date().getHours() + ':' + new Date().getMinutes();

            if (this.get('fired_courses') == ''){
                this.set({
                    'fired_courses': f_course + '-' + current_time
                });
            } else {
                this.set({
                    'fired_courses': this.get('fired_courses') + '|' + f_course + '-' + current_time
                });
            }
        },

        set_fired_courses: function(fired_courses){
            this.set({'fired_courses': fired_courses});
        },

        get_fired_courses: function(){
            if (this.get('fired_courses')) {
                return this.get('fired_courses');
            }
            else {
                return '';
            }
        },

        set_order_name: function(order_name){
            this.set('order_name',order_name);
        },
        get_order_name: function(){
            if (this.get('order_name')){
                return this.get('order_name');
            }
            else
            {
                return "No-Table";
            }
        },
        set_internal_message: function(internal_message){
            this.set('internal_message',internal_message);
        },
        geT_internal_message: function(){
            if (this.get('internal_message')){
                return this.get('internal_message');
            }
            else
            {
                return "";
            }
        },
        set_order_ref: function(order_ref){
            this.set('order_ref',order_ref);
        },
        get_order_ref: function(){
            if (this.get('order_ref')){
                return this.get('order_ref');
            }
            else
            {
                return "No-Ref";
            }
        },
        assign_tables: function(tables){
            this.set({'table_ids': tables});
        },
        get_tables: function(){
            if (this.get('table_ids')) {
				return this.get('table_ids');
			}
			else {
				return [];
			}
        },
        set_seats: function(seats){
            this.set({'number_seats': seats});
        },
        get_seats: function(){
            if (this.get('number_seats')) {
                return this.get('number_seats');
            }
            else {
                return 0;
            }
        },
        create_table_order: function(){
            var self = this;
            if (!this.get_order_id())
            {
                (new instance.web.Model('pos.order')).get_func('create_table_order_from_ui')([self.export_for_table_order_creation()], {}).then(function(order_id){
                        self.set_order_id(order_id);
                        self.set_timestamp(0);
                        self.start_synch();
                        /*
                        return self.pos.synchorders.get_order_timestamp(order_id);
                    }).then(function(order_timestamp){
                        for(var order in order_timestamp) {
                            order_id = order;
                            timestamp = order_timestamp[order];
                            self.set_order_id(order_id);
                            self.set_timestamp(timestamp);
                        }
                        */
                    });
            }
            else
            {
                this.reassign_table();
            }
        },
        reassign_table: function(){
            var self = this;
            (new instance.web.Model('pos.order')).get_func('reassign_tables_from_ui')(self.get_order_id(),[self.export_for_table_reassignment()], {});
        },
        set_order_tables_state: function(state){
            var self = this;
            (new instance.web.Model('pos.order')).get_func('set_order_tables_state')(self.get_order_id(),state, {});
        },
        export_for_table_reassignment: function() {
            return {
                table_ids: this.get_tables(),
                number_of_seats: this.get_seats(),
                courses: this.get_courses(),
                internal_message: this.geT_internal_message(),
                current_course: this.get_current_course(),
            };
        },
        // Do not confuse with export_as_json()
		export_for_table_order_creation: function() {
            return {
                name: this.getName(),
                pos_session_id: this.pos.pos_session.id,
                partner_id: this.partner_id,
                user_id: this.pos.cashier ? this.pos.cashier.id : this.pos.user.id,
                table_ids: this.get_tables(),
                number_of_seats: this.get_seats(),
                courses: this.get_courses(),
                internal_message: this.geT_internal_message(),
            };
        },
        // Do not confuse with export_as_json()
		exportAsJSON: function() {
            var orderLines, paymentLines;
            orderLines = [];
            (this.get('orderLines')).each(_.bind( function(item) {
                return orderLines.push([0, 0, item.export_as_JSON()]);
            }, this));
            paymentLines = [];
            (this.get('paymentLines')).each(_.bind( function(item) {
                return paymentLines.push([0, 0, item.export_as_JSON()]);
            }, this));
            this.partner_id = 0
            if($('#optionPartner').val()){
            	for(partner in this.pos.attributes.partner_list){
            		if(this.pos.attributes.partner_list[partner].name == $('#optionPartner').val()){
            			this.partner_id = this.pos.attributes.partner_list[partner].id
            		}
            	}
            }
            return {
                name: this.getName(),
                amount_paid: this.getPaidTotal(),
                amount_total: this.getTotalTaxIncluded(),//ToDo: TaxIncluded or TaxExcluded
                amount_tax: this.getTax(),
                amount_return: this.getChange(),
                lines: orderLines,
                statement_ids: paymentLines,
                pos_session_id: this.pos.pos_session.id,
                partner_id: this.partner_id,
                user_id: this.pos.cashier ? this.pos.cashier.id : this.pos.user.id,
                table_ids: this.get_tables(),
                number_of_seats: this.get_seats(),
                courses: this.get_courses(),
                internal_message: this.geT_internal_message(),
                order_id: this.get_order_id() ? this.get_order_id() : null,
                to_invoice: false,
            };
        },
	});

	module.NumpadWidget = module.NumpadWidget.extend({

        clickAppendNewChar: function(event) {
            var self = this;
            var current_order = this.pos.get('selectedOrder');
            var current_line = current_order.getSelectedLine();
            var mode = this.state.get('mode');
            var allow_change = true;

            if (mode == 'quantity'){
                if (current_line) {
                    if (current_line.get_sent_to_kitchen()){
                        if(current_line.order_line_state_id[0] > 1){
                            allow_change = false;
                            alert ("Line has been printed already.\n " +
                                   "Please use 'Duplicate' button to create an identical new order-line.");
                        }
                    }
                }
            }

            if (mode == 'price'){

                if (mode == 'price') {
                    if (current_line && current_line.product.list_price > 0) {
                        allow_change = false;
                        alert("Cannot change price for this product.");
                    }
                }
            }

            if (allow_change)
                this._super(event);
        },

        // backspace button: Avoid deletion of lines
        clickDeleteLastChar: function() {
            var self = this;
            var current_order = this.pos.get('selectedOrder');
            var current_line = current_order.getSelectedLine();

            var mode = this.state.get('mode');
            var allow_change = true;

            if (mode == 'quantity'){
                if (current_line) {
                    if (current_line.quantity == 0){
                        allow_change = false;
                        alert ("Please use 'Void' button to remove the line.");
                    }
                }
            }

            if (mode == 'price') {
                if (current_line && current_line.product.list_price > 0) {
                    allow_change = false;
                    alert("Cannot change price for this product.");
                }
            }

            if (allow_change)
                this._super();
        }
    });

    module.OrderWidget = module.OrderWidget.extend({
        set_value: function(val) {
        	var order = this.pos.get('selectedOrder');
        	if (this.editable && order.getSelectedLine()) {
                var mode = this.numpad_state.get('mode');
                if( mode === 'quantity') {
                    var currentLine = order.getSelectedLine();
                    if (currentLine.get_sent_to_kitchen()){
                        alert("This line has been sent to kitchen already, you may use 'Duplicate' to edit on a new identical line.");
                    } else {
                        order.getSelectedLine().set_quantity(val);
                    }
                }else if( mode === 'discount'){
                    order.getSelectedLine().set_discount(val);
                }else if( mode === 'price'){
                    order.getSelectedLine().set_unit_price(val);
                }
        	}
        }
    });

}