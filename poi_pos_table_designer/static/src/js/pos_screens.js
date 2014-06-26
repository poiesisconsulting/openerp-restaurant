function poi_pos_screens(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;
/*
    module.PaymentScreenWidget = module.PaymentScreenWidget.extend({

        validate_order: function(options) {
            var order = this.pos.get('selectedOrder');

            if (order.everything_on_kitchen())
            {
                this._super(options);
            }
            else
            {
                alert('You have to send all the lines to the kitchen');
                //this.pos_widget.screen_selector.set_current_screen('products');
            }
        },
    });

*/
    module.MergeOrdersScreenWidget = module.MergeOrdersScreenWidget.extend({
        get_table_header: function(){
            var currentOrder = this.pos.get('selectedOrder');

            var tables=currentOrder.get_tables();

            var name_header = '';
            var order_name = '';
            var count = 0;

            _.each(this.pos.tables_list, function(table){
                if ($.inArray(table.id,tables)>=0){
                    if (count == 0){
                        name_header=table.name;
                        order_name=table.code;
                        count++;
                    }
                    else{
                        name_header+=' - '+table.name;
                        order_name+=' - '+table.code;
                        count++;
                    }
                }

                //var find_table = _.filter(table.user_ids)
                //var find_prop = _.filter(product.attributes.description_ids, function(num){ return num == table.id; });
            });
            currentOrder.set_order_name(order_name);
            return name_header;
        },
    });

	module.SelectTableScreenWidget = module.ScreenWidget.extend({
        template: 'SelectTableScreenWidget',
        back_screen: 'products',
        next_screen: 'products',
        show_leftpane: false,
        start: function () {
            var self = this;
            //Initializing variables
            var areas = [];
            this.tables_selected = [];
            this.tables_on_current_screen = [];
            this.active_user = this.pos.user.id;

            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});

            this.gridster2 = $(".table-gridster > ul").gridster({
                widget_margins: [15, 15],
                widget_base_dimensions: [10, 10],
                autogenerate_stylesheet: false,
                avoid_overlapped_widgets: false,
                min_cols: 20,
                max_cols: 200,
                resize: {
                    enabled: false
                },
                draggable: {
                   handle: 'header'
                }
            }).data('gridster');

            //this.gridster2.generate_stylesheet();


            //Loading Areas
            areas = self.pos.areas_list;

            self.$el.find('.oe_table_select_area').children().remove().end();

            this.selected_area = false;
            if (areas.length>0){
                //default_area=areas[0].id;
                this.selected_area = false;
                valid_areas = 0;

                _.each(areas, function(area){
                    if (!self.selected_area){
                        self.selected_area = area.id;
                    }
                    o = new Option(area.name, area.id);
                    self.$el.find('.oe_table_select_area').append(o);
                    valid_areas += 1;
                });
                //We don't have to choose if there is only one area
                if (valid_areas == 1){
                    self.$el.find('.oe_table_select_area').hide();
                };
            };

            this.$el.find('.oe_table_select_area').val(self.selected_area);
            //Loading all the tables. We're not going to rerender everytime
            this.tables = this.pos.get_all_tables();
            //ToDo: We're going to check if it's not slower if we do this.
            this.render_tables_layout();


            this.$el.find('.oe_table_select_area').off('change').change(function() {
                //Loading Tables from default_area(as objects)
                self.selected_area = this.value;
                self.refresh_tables_displayed();
            });

        },
        show: function(){
            //ToDo: When we are showing up, we've to check if there are some tables selected. So this place must select all the tables that order has selected
            this._super();
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            //We do need to clean everything because we're not reloading our screen all the time
            this.mark_all_tables_as_unselected();

            if (currentOrder){
                this.tables_selected = currentOrder.get_tables();
            };

            if (self.tables_selected.length>0){
                _.each(self.tables_selected, function(select_table){
                    self.mark_table_as_selected(select_table);
                });
            };

            //Buttons
            this.back_button = this.add_action_button({
                    label: 'Back',
                    icon: '/point_of_sale/static/src/img/icons/png48/go-previous.png',
                    click: function(){
                        self.pos_widget.screen_selector.set_current_screen(self.back_screen);
                    },
                });

            this.validate_button = this.add_action_button({
                label: 'Validate',
                name: 'validation',
                icon: '/point_of_sale/static/src/img/icons/png48/validate.png',
                click: function(){
                    tables_displayed=self.$el.find('.table-widget');

                    seat_number=0;
                    _.each(tables_displayed, function(table){
                        if ($(table).attr('selected'))
                        {
                            seat_number+=parseInt($(table).attr('seats'));
                        }
                    });
                    if (seat_number>0){
                        currentOrder.assign_tables(self.tables_selected);
                        currentOrder.set_seats(seat_number);
                        currentOrder.create_table_order();
                    }
                    self.pos_widget.screen_selector.set_current_screen(self.next_screen);
                },
            });

        },
        refresh_screen: function(){
            var self = this;
            var valid_area = false;

            if (!this.selected_area){
                alert('There is no area defined!');
            };
            //Loading Areas
            areas = self.pos.areas_list;
            self.$el.find('.oe_table_select_area').children().remove().end();

            if (areas.length>0){
                //default_area=areas[0].id;
                var valid_areas = 0;

                _.each(areas, function(area){
                    number_of_tables = self.pos.get_user_table_ids_from_area(self.active_user, area.id);
                    if (number_of_tables.length > 0){
                        if (!valid_area){
                            valid_area = area.id;
                        }
                        o = new Option(area.name, area.id);
                        self.$el.find('.oe_table_select_area').append(o);
                        valid_areas += 1;
                    }
                });
                if (valid_area){
                    this.selected_area = valid_area;
                    this.$el.find('.oe_table_select_area').val(this.selected_area);
                }
                //We don't have to choose if there is only one area
                if (valid_areas <= 1){
                    self.$el.find('.oe_table_select_area').hide();
                }
                else {
                    self.$el.find('.oe_table_select_area').show();
                }
                this.refresh_tables_displayed();
            };


        },
        refresh_tables_displayed: function(){
            if (this.selected_area){
                var tables_displayed = this.pos.get_user_table_ids_from_area(this.active_user, this.selected_area);
                this.tables_on_current_screen = tables_displayed;
                this.display_tables(tables_displayed);
            }
        },
        change_active_user: function(user_id){
            this.active_user = user_id;
            this.refresh_screen();
        },
        render_tables_layout: function(){
            var self = this;
            $.when(this.get_tables_layout()).then(function(graph_tables){
                self.gridster2.remove_all_widgets();
                $.each(graph_tables, function(i, table){
                    self.gridster2.add_widget.apply(self.gridster2, table);
                });
            }).then(function(){
                self.gridster2.generate_stylesheet();
                self.hide_all_tables();

                self.$el.find('.table-widget').off('click').click(function(e){
                    if ($(this).attr('selected')){
                        self.tables_selected=self.deselect_table($(this).attr('table-id'),self.tables_selected);
                    }
                    else if (!$(this).attr('selected') && $(this).attr('state')=='open')
                    {
                        self.tables_selected=self.select_table($(this).attr('table-id'),self.tables_selected);
                    }
                });
                /*self.set_tables_displayed(tables);*/
                self.get_tables_state();
            });
        },
        get_tables_layout: function(){
            var self = this;
            var tables = this.tables;
            graph_tables=[]
            _.each(tables, function(table){
                graph_tables.push(self.get_table_widget(table));
            });
            return graph_tables;
        },
        //This receive table as object
        get_table_widget: function(table){
            table_data=''+table.name+' ('+table.number_of_seats+')<br/>'+'<span class="table-state">('+table.state+')</span>';
            return ['<li class="table-widget" table-id="'+table.id+'" state="'+table.state+'" seats="'+table.number_of_seats+'">'+table_data+'</li>',(table.size_x ? table.size_x :3),(table.size_y ? table.size_y :3),table.col,table.row,20,20,table.id];
        },
        hide_all_tables: function(){
            this.$el.find('.table-widget').hide();
            this.tables_on_current_screen = [];
        },
        display_tables: function(tables){
            var table_widget = false;
            this.hide_all_tables();
            for(var i = 0, len = tables.length; i < len; i++){
                table_widget = this.$el.find('li[table-id="'+tables[i]+'"]');
                if (table_widget){
                    table_widget.show();
                }
            }
            this.tables_on_current_screen = tables;
        },
        //Functions to mark selected or unselected
        mark_table_as_selected: function(table_id){
            var table_grid = this.$el.find('li[table-id="'+table_id+'"]');
            table_grid.attr('selected','selected');
        },
        mark_table_as_unselected: function(table_id){
            var table_grid = this.$el.find('li[table-id="'+table_id+'"]');
            table_grid.removeAttr('selected');
        },
        mark_all_tables_as_unselected: function(){
            var table_grid = this.$el.find('li.table-widget');
            table_grid.removeAttr('selected');
        },
        select_table: function(table_id, tables_selected){
            this.mark_table_as_selected(table_id);
            tables_selected.push(parseInt(table_id));
            return tables_selected
        },
        deselect_table: function(table_id, tables_selected){
            this.mark_table_as_unselected(table_id);
            var table_index = tables_selected.indexOf(parseInt(table_id));
            if (table_index > -1) {
                tables_selected.splice(table_index, 1);
            }
            return tables_selected
        },
        get_table_by_id: function(table_id){
            var table_found = false;
            _.each(this.pos.tables_list, function(table){
                if (table.id==table_id) {
                    table_found = table;
                }
            });
            return table_found;
        },
        get_table_state: function(table_id){
            var state = this.get_table_by_id(table_id).state;
            return state;
        },
        set_table_state: function(table_id, state){
            var self = this;
            _.each(this.pos.tables_list, function(table){
                if (table.id==table_id) {
                    table.state = state;

                    self.$el.find('li[table-id='+table_id+']').attr('state',state);
                    self.$el.find('li[table-id='+table_id+']').find('.table-state').html('('+state+')');
                    /*
                    $.when(self.remove_table_from_grid(table.id)).then(function(){
                        self.add_table_to_grid(table.id);
                    });*/
                }
            });
        },
        //Synch function
        get_tables_state: function(){
            var self = this;

            if(!this.tables_keptalive){
                this.tables_keptalive = true;
                function status(){
                    self.connection.rpc('/poi_pos_table_designer/get_tables_state',{'tables': self.tables_on_current_screen})
                        .then(function(tables_state){
                            var changed = false;
                            if (!tables_state.error){
                                _.each(tables_state.tables_state, function(table_state, table_id){
                                    if(table_state!=self.get_table_state(table_id)){
                                        self.set_table_state(table_id, table_state);
                                        changed = true;
                                    }
                                });
                            }
                            return changed;
                            //self.set_connection_status('connected',driver_status);
                        }).then(function(changed){
                            if (changed){
                                self.$el.find('.table-widget').off('click').click(function(e){
                                    if ($(this).attr('selected') && e.target==this){
                                        self.tables_selected=self.deselect_table($(this).attr('table-id'),self.tables_selected);
                                    }
                                    else if (!$(this).attr('selected') && $(this).attr('state')=='open' && e.target==this)
                                    {
                                        self.tables_selected=self.select_table($(this).attr('table-id'),self.tables_selected);
                                    }
                                });
                            };
                        }).always(function(){
                            setTimeout(status,6500);
                        });
                }
                status();
            };
        },

    });

}
