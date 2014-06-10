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
	module.SelectTableScreenWidget = module.ScreenWidget.extend({
        template:'SelectTableScreenWidget',
        back_screen:'products',
        next_screen:'products',
        show_leftpane: false,
        start: function(){
            var self = this;

            this.tables_on_display = [];

            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});

            this.gridster2 = $(".table-gridster > ul").gridster({
                  widget_margins: [15, 15],
                  widget_base_dimensions: [10, 10],
                  autogenerate_stylesheet: false,
                  avoid_overlapped_widgets: true,

                  resize: {
                        enabled: false
                  },
                  draggable: {
                        handle: 'header'
                  }
            }).data('gridster');

            //this.gridster2.generate_stylesheet();

        },
        show: function(){
            this._super();
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            this.gridster2.generate_stylesheet();

            //Initializing variables
            var areas = [];
            this.tables_selected = [];
            if (currentOrder){
                this.tables_selected = currentOrder.get_tables();
            };

            var active_user = this.pos.user.id

            //Loading active user or session
            if (this.pos.cashier) {
                active_user = this.pos.cashier.id;
            };

            //Loading Areas
            areas = self.pos.areas_list;

            self.$el.find('.oe_table_select_area').children().remove().end();

            default_area = false;
            if (areas.length>0){
                //default_area=areas[0].id;
                default_area = false;
                valid_areas = 0;

                _.each(areas, function(area){
                    number_of_tables = self.pos.get_user_table_ids_from_area(active_user, area.id);
                    if (number_of_tables.length > 0){
                        if (!default_area){
                            default_area = area.id;
                        }
                        o = new Option(area.name, area.id);
                        self.$el.find('.oe_table_select_area').append(o);
                        valid_areas += 1;
                    }
                });
                //We don't have to choose if there is only one area
                if (valid_areas == 1){
                    self.$el.find('.oe_table_select_area').hide();
                };
            };

            this.$el.find('.oe_table_select_area').val(default_area);
            //Loading Tables from default_area(as objects)
            var tables = this.pos.get_user_tables_from_area(active_user, default_area);

            this.render_tables_layout(tables);

            this.$el.find('.oe_table_select_area').off('change').change(function() {
                //Loading Tables from default_area(as objects)
                var tables = self.pos.get_user_tables_from_area(active_user, this.value);
                self.render_tables_layout(tables);
            });

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
        render_tables_layout: function(tables){
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            $.when(this.get_tables_layout(tables)).then(function(graph_tables){
                self.gridster2.remove_all_widgets();
                $.each(graph_tables, function(i, table){
                    self.gridster2.add_widget.apply(self.gridster2, table);
                });
            }).then(function(){

                self.$el.find('.table-widget').off('click').click(function(e){
                    if ($(this).attr('selected')){
                        self.tables_selected=self.deselect_table($(this).attr('table-id'),self.tables_selected);
                    }
                    else if (!$(this).attr('selected') && $(this).attr('state')=='open')
                    {
                        self.tables_selected=self.select_table($(this).attr('table-id'),self.tables_selected);
                    }
                });
                self.set_tables_displayed(tables);
                self.get_tables_state();
            }).then(function(){
                if (self.tables_selected.length>0){
                    _.each(self.tables_selected, function(select_table){
                        self.mark_table_as_selected(select_table);
                    });
                };
            });
        },
        set_tables_displayed: function(tables){
            var tables_on_display = []
            _.each(tables, function(table){
                tables_on_display.push(table.id);
            });
            this.tables_on_display = tables_on_display;
        },
        mark_table_as_selected: function(table_id){
            var table_grid = this.$el.find('li[table-id="'+table_id+'"]');
            table_grid.attr('selected','selected');
        },
        select_table: function(table_id, tables_selected){
            this.mark_table_as_selected(table_id);
            tables_selected.push(parseInt(table_id));
            return tables_selected
        },
        deselect_table: function(table_id, tables_selected){
            var table_grid = this.$el.find('li[table-id="'+table_id+'"]');
            table_grid.removeAttr('selected');
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
        add_table_to_grid: function(table_id){
            var table = this.get_table_by_id(table_id);
            var table_grid = this.get_tables_layout([table])[0];
            this.gridster2.add_widget.apply(this.gridster2, table_grid);
        },
        remove_table_from_grid: function(table_id){
            this.gridster2.remove_widget($('.table-gridster li[table-id='+table_id+']'));
        },
        get_tables_layout: function(tables){
            graph_tables=[]
            _.each(tables, function(table){
                table_data=''+table.name+' ('+table.number_of_seats+')<br/>'+'<span class="table-state">('+table.state+')</span>';

                graph_tables.push(['<li class="table-widget" table-id="'+table.id+'" state="'+table.state+'" seats="'+table.number_of_seats+'">'+table_data+'</li>',(table.size_x ? table.size_x :3),(table.size_y ? table.size_y :3),table.col,table.row,20,20,table.id]);
            });

            return graph_tables;
        },
        get_tables_state: function(table_ids){
            var self = this;

            /*var tables = []
            _.each(table_ids, function(table){
                tables.push(table.id);
            });*/

            if(!this.tables_keptalive){
                this.tables_keptalive = true;
                function status(){
                    self.connection.rpc('/poi_pos_table_designer/get_tables_state',{'tables': self.tables_on_display})
                        .then(function(tables_state){
                            var changed = false;
                            if (!tables_state.error){
                                _.each(tables_state.tables_state, function(table_state, table_id){
                                    if(table_state!=self.get_table_state(table_id)){
                                        self.set_table_state(table_id, table_state);
                                        //self.remove_table_from_grid(table_id);
                                        //self.add_table_to_grid(table_id);
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
        close: function(){
            this._super();
            var self = this;

        },
    });

}
