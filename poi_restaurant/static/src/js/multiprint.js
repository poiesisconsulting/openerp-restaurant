function openerp_restaurant_multiprint(instance,module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;

    module.Printer = instance.web.Class.extend(openerp.PropertiesMixin,{
        init: function(parent,options){
            openerp.PropertiesMixin.init.call(this,parent);
            var self = this;
            options = options || {};
            var url = options.url || 'http://localhost:8069';
            this.connection = new instance.web.Session(undefined,url, { use_cors: true});
            this.host       = url;
            this.receipt_queue = [];
        },
        print: function(receipt){
            console.log('QUE ESTA IMPRIMIENDO?', receipt);
            var self = this;
            if(receipt){
                this.receipt_queue.push(receipt);
            }
            var aborted = false;
            function send_printing_job(){
                if(self.receipt_queue.length > 0){
                    var r = self.receipt_queue.shift();
                    self.connection.rpc('/hw_proxy/print_xml_receipt',{receipt: r},{timeout: 5000})
                        .then(function(){
                            send_printing_job();
                        },function(){
                            self.receipt_queue.unshift(r);
                        });
                }
            }
            send_printing_job();
        },
    });

    var OldPosModel = module.PosModel;

    module.PosModel = module.PosModel.extend({
        load_server_data: function(){
            var self = this;
            var loaded = OldPosModel.prototype.load_server_data.call(this)
                .then(function(){
                    return self.fetch('restaurant.printer',['name','proxy_ip','product_categories_ids']);
                }).then(function(printers){
                    var active_printers = {};
                    for(var i = 0; i < self.config.printer_ids.length; i++){
                        active_printers[self.config.printer_ids[i]] = true;
                    }
                    self.printers = [];
                    for(var i = 0; i < printers.length; i++){
                        if(active_printers[printers[i].id]){
                            var printer = new module.Printer(self,{url:'http://'+printers[i].proxy_ip+':8069'});
                            printer.config = printers[i];
                            self.printers.push(printer);
                        }
                    }
                });
            return loaded;
        },
    });

    module.Order = module.Order.extend({
        lineResume: function(){
            var resume = {};
            var self = this;
            var modifiers = [];

            this.get('orderLines').each(function(item){
                var line = item.export_as_JSON();
                if (line.product_id) {
                    line.name = self.pos.db.get_product_by_id(line.product_id).name;

                    if (line.product_ids && line.product_ids.length>0){
                        for(var i = 0; i < line.product_ids.length; i++){
                            if(line.product_ids[i]){
                                modifiers.push(self.pos.db.get_product_by_id(line.product_ids[i][2].product_id).name)
                            }
                        }
                    }
                }

                line.modifiers = modifiers;
                resume[line.unique_name] = line;
                modifiers = [];
            });
            return resume;
        },
        saveChanges: function(){
            var self = this;
            this.old_resume = this.lineResume();
            (new instance.web.Model('pos.order')).get_func('assign_value_to_order')(self.get_order_id(),self.get_old_resume());
        },
        set_old_resume: function(old_resume_text){
            this.old_resume = $.parseJSON(old_resume_text);
        },
        get_old_resume: function(){
            return JSON.stringify(this.old_resume);
        },
        computeChanges: function(categories){
            var current = this.lineResume();
            var old     = this.old_resume || {};
            var json    = this.export_as_JSON();
            var add = [];
            var rem = [];

            for( unique_name in current){
                if (typeof old[unique_name] === 'undefined'){
                    temp_line = current[unique_name];
                    add.push(temp_line);
                } else if (old[unique_name]){
                    if( old[unique_name].qty < current[unique_name].qty){
                        temp_line = current[unique_name];
                        temp_line.qty = temp_line.qty - old[unique_name].qty;
                        add.push(temp_line);
                    }else if( old[unique_name].qty > current[unique_name].qty){
                        temp_line = current[unique_name];
                        temp_line.qty = old[unique_name].qty - temp_line.qty;
                        rem.push(temp_line);
                    }
                }
            }

            for( unique_name in old){
                if(typeof current[unique_name] === 'undefined'){
                    temp_line = old[unique_name];
                    rem.push(temp_line);
                }
            }

            if(categories && categories.length > 0){
                // filter the added and removed orders to only contains
                // products that belong to one of the categories supplied as a parameter

                var self = this;
                function product_in_category(product_id){
                    var cat = self.pos.db.get_product_by_id(product_id).public_categ_id[0];
                    while(cat){
                        for(var i = 0; i < categories.length; i++){
                            if(cat === categories[i]){
                                return true;
                            }
                        }
                        cat = self.pos.db.get_category_parent_id(cat);
                    }
                    return false;
                }

                var _add = [];
                var _rem = [];
                
                for(var i = 0; i < add.length; i++){
                    if(product_in_category(add[i].product_id)){
                        _add.push(add[i]);
                    }
                }
                add = _add;

                for(var i = 0; i < rem.length; i++){
                    if(product_in_category(rem[i].product_id)){
                        _rem.push(rem[i]);
                    }
                }
                rem = _rem;

            }

            add = this.sort_kitchen_receipt(add);
            rem = this.sort_kitchen_receipt(rem);
            if (this.pos.cashier){
                uname = self.pos.cashier.name;
            }
            else
            {
                uname = '';
            }



            return {
                'user_name': uname,
                'new': add,
                'cancelled': rem,
                'tables': this.pos.get_tables_code(json.table_ids),
                'areas': this.pos.get_tables_area_name(json.table_ids),
                'name': json.name  || 'unknown order',
                'number_of_seats': json.number_of_seats || 0,
                'covers': json.covers || 0,
                'time': this.get_mytime(),
            };
            
        },

        //*********************DAO-SYSTEMS********************************************************
        get_DAO_structure: function(add,rem){
            var aux ={'new': this.get_DAO_GroupBy(add, function(item){
                                                    return [parseInt(item.sequence)];
                                                }),
                    'cancelled': this.get_DAO_GroupBy(rem, function(item){
                                                    return [parseInt(item.sequence)];
                                                })
                    };
			var arr=[];
			if (aux.new && aux.new.length>0){
				for (var i = aux.new.length - 1; i >= 0; i--) {
                    aux.new[i] = this.get_DAO_GroupBy(aux.new[i], function(item){
                                                        return [item.name];
                                                    });
                };
                
			};

			if (aux.cancelled && aux.cancelled.length>0){
                for (var i = aux.cancelled.length - 1; i >= 0; i--) {
                    aux.cancelled[i] = this.get_DAO_GroupBy(aux.cancelled[i], function(item){
                                                        return [item.name];
                                                    });
                };
            };

        	aux.new = this.get_DAO_Rearrange(aux.new);
            aux.cancelled = this.get_DAO_Rearrange(aux.cancelled);

            return aux


                    
        },

        get_DAO_GroupBy: function(array , f ){
            var groups = {};
            if (array && array.length >0){
                            array.forEach( function( o )
              {
                var group = JSON.stringify( f(o) );
                groups[group] = groups[group] || [];
                groups[group].push( o );  
              });
              return Object.keys(groups).map( function( group )
              {
                return groups[group]; 
              })

            };
        }, 

        get_DAO_Rearrange:function(array){
            var resp =[];
            if (array && array.length>0) {
                for (var i =0; i < array.length; i++) {
                    resp.push({
                                'Course': parseInt(array[i][0][0].sequence),
                                'Items': this.get_DAO_RearrangeItems(array[i])
                              }
                            ); 
                };
            };
            return resp
        },
        

		
		get_DAO_RearrangeItems:function(array){
            var resp =[];
            
            
            if (array && array.length>0) {
                for (var i =0; i < array.length; i++) {
                    var subArray = array[i];
                    var obj = {
                                'sequence': parseInt(subArray[0].sequence),
                                'name': subArray[0].name,
                                'qty': subArray.map(function(item){
                                                        return item.qty;
                                                    }).reduce(function(a,b){
                                                                return a+b;
                                                            },0),
                                'seats':[]
                                };
                    var arrModificadores = this.get_DAO_GroupBy(subArray, function(item){
                                                                return ['[' + item.modifiers.join() + ']' + item.order_line_notes];
                                                                });

                    for (var k = 0; k < arrModificadores.length; k++) {
                        obj.seats.push({
                                        'Numbers': arrModificadores[k].map(function(item){
                                                                                var full_seat = item.seat.toString();
                                                                                if (full_seat == '0') {
                                                                                    full_seat = 'TBL';
                                                                                }
                                                                                else {
                                                                                    full_seat = full_seat;
                                                                                    if (item.lady) {
                                                                                        full_seat += 'L';
                                                                                    }
                                                                                }
                                                                                return full_seat
                                                                            }).join(),
                                        'modifiers': arrModificadores[k][0].modifiers,
                                        'order_line_notes': arrModificadores[k][0].order_line_notes,
                                        'sub_qty': arrModificadores[k].length,
                                        }
                                      );
                         
                    };

                    resp.push(obj);     
                };
            };

            
            return resp
        },

        //*****************************************************************************

        dynamicSort: function(property){
            return function (obj1,obj2) {
                return obj1[property] > obj2[property] ? 1
                : obj1[property] < obj2[property] ? -1 : 0;
            }
        },
        dynamicSortMultiple: function() {
            /*
             * save the arguments object as it will be overwritten
             * note that arguments object is an array-like object
             * consisting of the names of the properties to sort by
             */
            var props = arguments;
            var self = this;
            return function (obj1, obj2) {
                var i = 0, result = 0, numberOfProperties = props.length;
                /* try getting a different result from 0 (equal)
                 * as long as we have extra properties to compare
                 */
                while(result === 0 && i < numberOfProperties) {
                    result = self.dynamicSort(props[i])(obj1, obj2);
                    i++;
                }
                return result;
            }
        },
        /*
        Comentado, xq no queremos items que se llamen '-----------------------'
        sort_kitchen_receipt: function(list_to_sort){
            var self=this;
            var courses_list = [];

            for(var i = 0; i < list_to_sort.length; i++){
                courses_list.push(parseInt(list_to_sort[i].sequence));
            }

            var unique_courses = [];
            $.each(courses_list, function(i, el){
                if($.inArray(el, unique_courses) === -1) unique_courses.push(el);
            });

            unique_courses.sort();

            for(var j = 0; j < unique_courses.length; j++){
                list_to_sort.push({'sequence': parseInt(unique_courses[j]),
                                    'product_id': 0,
                                    'modifiers': [],
                                    //'name': '--------COURSE '+unique_courses[j]+'-------',
                                    'name': '-----------------------',
                                    'qty': false,
                                    })
            }

            list_to_sort.sort(self.dynamicSortMultiple("sequence","product_id","seat"));

            return list_to_sort;
        },*/
        sort_kitchen_receipt: function(list_to_sort){
            var self=this;
            list_to_sort.sort(self.dynamicSortMultiple("sequence","product_id","seat"));

            return list_to_sort;
        },
        get_mytime: function() {
            var now     = new Date();
            var hour    = now.getHours();
            var minute  = now.getMinutes();
            var daytime = 'am';
            if (hour > 11) {
                daytime = 'pm';
            }
            if (hour > 12) {
                hour -= 12;
            }
            if(hour.toString().length == 1) {
                var hour = '0'+hour;
            }
            if(minute.toString().length == 1) {
                var minute = '0'+minute;
            }

            var dateTime = hour+':'+minute+' '+daytime
            return dateTime;
        },
        printChanges: function(){
            var printers = this.pos.printers;
            for(var i = 0; i < printers.length; i++){
                var changes = this.computeChanges(printers[i].config.product_categories_ids);
                if ( changes['new'].length > 0 || changes['cancelled'].length > 0){

                    changes.DAO = this.get_DAO_structure(changes.new,changes.cancelled);
                    
                    var receipt = QWeb.render('OrderChangeReceipt',{changes:changes, widget:this});
                    printers[i].print(receipt);
                }
            }
        },
        hasChangesToPrint: function(){

            var currentOrder = this.pos.get('selectedOrder');
            var orderLines = currentOrder.get_all_lines();

            var not_kitchen = _.filter(orderLines, function(orLn){return orLn.sent_to_kitchen == false });

            if (not_kitchen.length == 0){
                this.old_resume = this.lineResume();
            }

            var printers = this.pos.printers;
            for(var i = 0; i < printers.length; i++){
                var changes = this.computeChanges(printers[i].config.product_categories_ids);
                if ( changes['new'].length > 0 || changes['cancelled'].length > 0){
                    return true;
                }
            }
            return false;
        }
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            if(this.pos.printers.length){

                var submitorder = $(QWeb.render('SubmitOrderButton'));

                submitorder.click(function(){
                    var currentOrder = self.pos.get('selectedOrder');
                    if(currentOrder.hasChangesToPrint()){
                        var lines = currentOrder.get_all_lines();
                        if(lines == ''){
                            alert('There are no lines to be sent.');
                        }
                        else {
                            (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function(order_id){
                                currentOrder.attributes.id = order_id[0];
                                for( idx in lines ){

                                    lines[idx].id = order_id[1][idx];
                                }
                                
                                currentOrder.printChanges();
                                
                                currentOrder.saveChanges();
                                self.pos_widget.order_widget.update_summary();
                                currentOrder.set_order_tables_state('order_taken');
                                
                                alert('Order sent to kitchen successfully !!!');
                                /*
                                return self.pos.synchorders.get_order_timestamp(order_id[0]);
                            }).then(function(order_timestamp){
                                for(var order in order_timestamp) {
                                    order_id = order;
                                    timestamp = order_timestamp[order];
                                    currentOrder.set_timestamp(timestamp);
                                }
                                */

                            });
                        }

                    }
                    else
                    {
                        var currentOrder = self.pos.get('selectedOrder');
                        (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function(order_id){
                            currentOrder.attributes.id = order_id[0];
                            for( idx in lines ){
                                lines[idx].id = order_id[1][idx];
                            }
                            currentOrder.set_order_tables_state('order_taken');
                            alert('Order sent to kitchen successfully');
                            /*return self.pos.synchorders.get_order_timestamp(order_id[0]);
                        }).then(function(order_timestamp){
                            for(var order in order_timestamp) {
                                timestamp = order_timestamp[order];
                                currentOrder.set_timestamp(timestamp);
                            }

                            */
                        });
                    }
                });
                
                submitorder.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
                //this.$('.control-buttons').find('.send-to-kitchen').hide();
            }
        },
        
    });

    module.OrderWidget.include({
        update_summary: function(){
            this._super();
            var order = this.pos.get('selectedOrder');

            if(order.hasChangesToPrint()){
                this.pos_widget.$('.order-submit').addClass('highlight');
            }else{
                this.pos_widget.$('.order-submit').removeClass('highlight');
            }
        },
    });


    module.SynchOrders = module.SynchOrders.extend({
        assign_values_to_order: function(order, order_data){
            this._super(order, order_data);
            order.set_old_resume(order_data.print_resume);
        },
        compare_order_data: function(order, order_data){
            this._super(order, order_data);
            //We need some conditions to do this
            if (order.get_old_resume() != order_data.print_resume)
            {
                order.set_old_resume(order_data.print_resume)
            }
        },
    });

}
