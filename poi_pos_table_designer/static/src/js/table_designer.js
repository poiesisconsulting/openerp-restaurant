function poi_table_designer(instance, module){

    instance.poi_pos_table_designer.Action = instance.web.Widget.extend({
        template: 'web_example.action',

        init: function(parent, view) {

            this._super(parent);
            this.view = view;
            this.type_window = 'manager';
            this.tables_on_display = [];

            //For Timers
            this.open_timer = 0;
            this.just_seated_timer = 0;
            this.order_taken_timer = 0;
            this.served_timer = 0;
            this.check_timer = 0;
            this.paid_timer = 0;

        },
        // helper function to load data from the server
        fetch: function(model, fields, domain, ctx){
            return new instance.web.Model(model).query(fields).filter(domain).context(ctx).all()
        },
        start: function(){

            var self = this;
            this.tables_selected = [];
            this.tables_list = [];

            this.type_window = this.view.context.type;
            this.connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});

            //We define if it's a designer window or hostess window

            if (this.type_window == 'designer'){
                $(self.$el.find('#table_designer_title')).html('Table Designer');
                $(self.$el.find('#table_hostess_buttons')).html('');
                self.gridster = $(".gridster > ul").gridster({
                      widget_margins: [15, 15],
                      widget_base_dimensions: [10, 10],
                      min_cols: 20,
                      max_cols: 200,
                      autogenerate_stylesheet: false,
                      resize: {
                            enabled: true
                      },
                }).data('gridster');
            }
            else if (this.type_window == 'hostess'){
                $(self.$el.find('#table_designer_title')).html('Table Assignment');
                $(self.$el.find('#table_manager_buttons')).html('');
                self.gridster = $(".gridster > ul").gridster({
                      widget_margins: [15, 15],
                      widget_base_dimensions: [10, 10],
                      min_cols: 20,
                      max_cols: 200,
                      autogenerate_stylesheet: false,
                      resize: {
                            enabled: false
                      },
                      draggable: {
                            handle: 'footer'
                      }
                }).data('gridster');
            }

            self.gridster.generate_stylesheet();


            //Getting tables from area selected

            this.$el.find('.oe_table_select_area').change(function() {
                self.get_tables_from_area(this.value);
                self.set_timers_from_area(this.value);
            });

            //Function to save the gridster

            this.$el.find('.oe_save_table_layout').click(function() {
                _.each(self.gridster.serialize(), function(widget){
                    (new instance.web.Model('table.table')).call('set_table_position',[widget]);
                })
            });


            //Function to call a wizard to create an order

            this.$el.find('.oe_create_table_order').click(function() {

                table_seats=self.$el.find('.number-seats-inputbox');

                seat_number=0;
                _.each(table_seats, function(table){
                    if ($(table).parent().attr('selected'))
                    {
                        seat_number+=parseInt($(table).val());
                    }
                });

                var action = {
                    type: 'ir.actions.act_window',
                    res_model: 'table.assigner.wizard',
                    view_mode: 'form',
                    view_type: 'form',
                    views: [[false, 'form']],
                    target: 'new',
                    context: {'tables_selected': self.tables_selected, 'number_of_seats': seat_number},
                };
                var am = new instance.web.ActionManager(self);

                am.do_action(action);
            });

            //We're loading and adding areas to selection

            this.area = this.fetch('table.area', [], [], []).then(function(areas){
                self.$el.find('.oe_table_select_area').children().remove().end();
                if (areas.length>0){
                    default_area=areas[0].id;

                    _.each(areas, function(area){
                        o = new Option(area.name, area.id);
                        self.$el.find('.oe_table_select_area').append(o);
                    })
                    return true;
                }
                else
                {
                    return false;
                }

            }).then(function(loaded){
                if (loaded){
                    self.get_tables_from_area(default_area);
                    self.set_timers_from_area(default_area);
                }

            });
            $('.gridster').addClass('touch-scrollable');
        },
        set_timers_from_area: function(area_id){
            var self = this;
            var timers = this.fetch('table.area',['open_timer','just_seated_timer','order_taken_timer','served_timer','check_timer','paid_timer'],[['id','=',area_id]],[]).then(function(area){
                if (area) {
                    self.open_timer = area[0].open_timer;
                    self.just_seated_timer = area[0].just_seated_timer;
                    self.order_taken_timer = area[0].order_taken_timer;
                    self.served_timer = area[0].served_timer;
                    self.check_timer = area[0].check_timer;
                    self.paid_timer = area[0].paid_timer;
                }
            });
        },
        get_tables_from_area: function(area_id){
            var area_id = parseInt(area_id);

            this.gridster.remove_all_widgets();

            var graph_tables=[];
            var self = this;

            var tables = this.fetch('table.table',[],[['area_id','=',area_id]],[]).then(function(tables){
                self.tables_list = tables;
                self.render_tables_layout(tables);
            }).then(function(){
                $.each(graph_tables, function(i, table){
                  self.gridster.add_widget.apply(self.gridster, table)
                });

            }).then(function(){
                if (self.type_window == 'designer') {
                    self.$el.find('.table-widget header').off('click').click(function(){

                        var pop = new instance.web.form.FormOpenPopup(self);
                        var table_id = $(this).parent().attr('table-id');

                        pop.show_element('table.table', parseInt(table_id), {},{});
        			});
                }
                else if (self.type_window == 'hostess') {

                    self.$el.find('.table-widget header').off('click').click(function(){
                        /*var pop = new instance.web.form.SelectCreatePopup(this);
                        pop.select_element(
                            self.field.relation,
                            {
                                title: (view === 'search' ? _t("Search: ") : _t("Create: ")) + this.string,
                                initial_ids: ids ? _.map(ids, function(x) {return x[0];}) : undefined,
                                initial_view: view,
                                disable_multiple_selection: true
                            },
                            self.build_domain(),
                            new instance.web.CompoundContext(self.build_context(), context || {})
                        );*/

                        var table_id = $(this).parent().attr('table-id');


                        var action = {
                            type: 'ir.actions.act_window',
                            res_model: 'table.menu.wizard',
                            view_mode: 'form',
                            view_type: 'form',
                            views: [[false, 'form']],
                            target: 'new',
                            context: {'table_selected': table_id},
                        };
                        var am = new instance.web.ActionManager(self);

                        am.do_action(action);
                    });
                }
            });
        },
        render_tables_layout: function(tables){
            var self = this;

            $.when(this.get_tables_layout(tables)).then(function(graph_tables){
                self.gridster.remove_all_widgets();
                $.each(graph_tables, function(i, table){
                    self.gridster.add_widget.apply(self.gridster, table);
                });
            }).then(function(){
                if (self.type_window == 'hostess'){
                    self.$el.find('.table-widget').off('click').click(function(e){
                        seats_on_table = $(this).find('.number-seats-inputbox').val();
                        if ($(this).attr('selected') && e.target==this){
                            self.tables_selected=self.deselect_table($(this).attr('table-id'),self.tables_selected);
                        }
                        else if (!$(this).attr('selected') && $(this).attr('state')=='open' && e.target==this)
                        {
                            self.tables_selected=self.select_table($(this).attr('table-id'),self.tables_selected);
                        }
                    });
                };
                self.set_tables_displayed(tables);
                self.get_tables_state();
            }).then(function(){
                if (self.tables_selected.length>0 && self.type_window == 'hostess'){
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
            _.each(this.tables_list, function(table){
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
            _.each(this.tables_list, function(table){
                if (table.id==table_id) {
                    table.state = state;
                    self.$el.find('li[table-id='+table_id+']').attr('state',state);
                    self.$el.find('li[table-id='+table_id+']').find('.table-state').html('('+state+')');
                    /*
                    $.when(self.remove_table_from_grid(table.id)).then(function(){
                        self.add_table_to_grid(table.id);
                    });
                    */
                }
            });
        },
        add_table_to_grid: function(table_id){
            var table = this.get_table_by_id(table_id);
            var table_grid = this.get_tables_layout([table])[0];
            this.gridster.add_widget.apply(this.gridster, table_grid);
        },
        remove_table_from_grid: function(table_id){
            this.gridster.remove_widget($('.gridster li[table-id='+table_id+']'));
        },
        get_tables_layout: function(tables){
            var self = this;
            graph_tables=[]
            _.each(tables, function(table){


            if (self.type_window == 'designer'){
                table_data=''+table.name+' ('+table.number_of_seats+')<br/>'+'<span class="table-state">('+table.state+')</span><br/><span class="table-orders"></span><br/>';
                graph_tables.push(['<li class="table-widget" table-id="'+table.id+'" state="'+table.state+'"><header><i class="fa fa-edit fa-2x"></i></header>'+table_data+'</li>',(table.size_x ? table.size_x :3),(table.size_y ? table.size_y :3),table.col,table.row,20,20,table.id]);
            }
            else if (self.type_window == 'hostess'){
                table_data=''+table.name+' ('+table.number_of_seats+')<br/>'+'<span class="table-state">('+table.state+')</span><br/><span class="table-orders"></span><br/><input class="number-seats-inputbox" type="number" value="'+table.number_of_seats+'">';
                graph_tables.push(['<li class="table-widget" table-id="'+table.id+'" state="'+table.state+'"><header><i class="fa fa-bars fa-2x"></i></header>'+table_data+'</li>',(table.size_x ? table.size_x :3),(table.size_y ? table.size_y :3),table.col,table.row,20,20,table.id]);
            }


            });

            return graph_tables;
        },
        set_table_timer: function(table_id,actual_time,max_area_time){
            var self = this;
            if (actual_time>=max_area_time){
                self.$el.find('li[table-id='+table_id+']').effect('highlight', {color: 'red'}, 3000);
            }
        },
        get_tables_state: function(){
            var self = this;

            if(!this.tables_keptalive){
                this.tables_keptalive = true;
                function status(){
                    self.connection.rpc('/poi_pos_table_designer/get_tables_state',{'tables': self.tables_on_display}).then(function(tables_state){
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
                            //self.set_connection_status('connected',driver_status);
                            return changed;
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
                                }).find('.table-widget header').off('click').click(function(){

                                    var table_id = $(this).parent().attr('table-id');


                                    var action = {
                                        type: 'ir.actions.act_window',
                                        res_model: 'table.menu.wizard',
                                        view_mode: 'form',
                                        view_type: 'form',
                                        views: [[false, 'form']],
                                        target: 'new',
                                        context: {'table_selected': table_id},
                                    };
                                    var am = new instance.web.ActionManager(self);

                                    am.do_action(action);
                                });


                            };
                            return self.connection.rpc('/poi_pos_table_designer/get_orders_with_state_timestamp',{'tables': self.tables_on_display});
                        }).then(function(table_orders){
                            _.each(table_orders, function(table_order, table_id){
                                order_tag = '';
                                for(var order_id in table_order) {
                                    var actual_date = new Date($.now());
                                    var state_date = new Date(table_order[order_id].creation_date);
                                    var time_remaining = new Date(actual_date - state_date);
                                    var minutes_remaining = time_remaining.getMinutes();
                                    var seconds_remaining = time_remaining.getSeconds();
                                    order_tag+='<span order-id='+order_id+' creation-date='+table_order[order_id].creation_date+'>'+table_order[order_id].name+' - '+minutes_remaining+' mins</span></br>';

                                }
                                self.$el.find('li[table-id='+table_id+']').find('.table-orders').html(order_tag);

                                table_state = self.$el.find('li[table-id='+table_id+']').attr('state');
                                if (table_state == 'open' && self.open_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.open_timer);
                                } else if (table_state == 'just_seated' && self.just_seated_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.just_seated_timer);
                                } else if (table_state == 'order_taken' && self.order_taken_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.order_taken_timer);
                                } else if (table_state == 'served' && self.served_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.served_timer);
                                } else if (table_state == 'check' && self.check_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.check_timer);
                                } else if (table_state == 'paid' && self.paid_timer != 0) {
                                    self.set_table_timer(table_id,minutes_remaining,self.paid_timer);
                                }
                            });
                        }).always(function(){
                            setTimeout(status,6500);
                        });
                }
                status();
            };
        },
    });

    instance.web.client_actions.add('pos.table.designer', 'instance.poi_pos_table_designer.Action');
    instance.web.client_actions.add('pos.table.hostess', 'instance.poi_pos_table_designer.Action');

}