function poi_pos_widgets(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;

    var round_di = instance.web.round_decimals;
    var round_pr = instance.web.round_precision;

    module.TableHeaderWidget = module.PosBaseWidget.extend({
	    template: 'TableHeaderWidget',
	    init: function(parent, options){
            var self = this;
            var options = options || {};
            this._super(parent,options);
            this.table_header='Order without tables';
            this.courses='';
            this.current_course='';
        },

        renderElement: function(){
            var self = this;

            //ToDo: Esta line oculta el boton del metodo de pago S&P; cambiar a un modulo mas apropiado
            var sp_button = self.pos_widget.$el.find("button:contains('Sales & Prom')");
            if (sp_button){
                sp_button.hide();
            }

            $.when(this._super()).then(function(){
                self.pos_widget.$el.find('.merge-orders.order-button').hide();
                self.$el.find('.merge-orders.table-button').off('click').click(function(){
                    var currentOrder = self.pos.get('selectedOrder');
                    if (currentOrder){
                        if (currentOrder.get_order_id()){
                            self.pos_widget.screen_selector.set_current_screen_no_close_popup('merge_orders_screen');
                        }
                        else{
                            alert('This order does not exist on the database, you only can merge orders already saved on the database');
                        }
                    }
                });
                self.$el.find('.assign-table').off('click').click(function(){
                     self.pos_widget.screen_selector.set_current_screen_no_close_popup('selecttable');
                     //self.pos_widget.screen_selector.show_popup('selecttablepopup');
                });
                self.$el.find('.internal-message-button').off('click').click(function(){
                     self.pos_widget.screen_selector.show_popup('InternalMessagePopup');
                     //self.pos_widget.screen_selector.show_popup('selecttablepopup');
                });

                self.$el.find('.send-to-kitchen-button').off('click').click(function(){
                    var currentOrder = self.pos.get('selectedOrder');
                    var lines = currentOrder.attributes.orderLines.models;
                    if(lines == ''){
                        alert('There are no lines to be sent.');
                    }
                    else{
                        (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function(order_id){
                            currentOrder.attributes.id = order_id[0];
                            for( idx in lines ){
                                lines[idx].id = order_id[1][idx];
                            }
                            currentOrder.set_order_tables_state('order_taken');
                            alert('Order saved successfully!');
                        });
                    }
                });
            }).then(function(){

                self.$el.find('.seat-button').off('click').click(function(){
                    seat_selected=$(this).attr('seat');
                    self.set_orderline_seat(seat_selected);
                });

                self.$el.find('.add-seat-button').off('click').click(function(){
                    var currentOrder = self.pos.get('selectedOrder');

                    var last_seats = currentOrder.get_seats();
                    currentOrder.set_seats(parseInt(last_seats) + 1);
                    currentOrder.reassign_table();

                    self.reset_table_header();
                });

                self.$el.find('.lady-button').off('click').click(function(){
                     seat_selected=$(this).attr('seat');
                     self.set_orderline_lady_seat(seat_selected);

                });

                self.$el.find('#course_add').off('click').click(function(){
                    var currentOrder = self.pos.get('selectedOrder');
                    var current_courses = self.$el.find('.course-button');
                    var last_course = current_courses.get( -1 );
                    var last_course_val = last_course.attributes.course.nodeValue;
                    var new_course_val = parseInt(last_course_val) + 1;

                    var new_button = '<button class="course-button table-button" course='+new_course_val+'>'+ new_course_val +'</button>';

                    $( new_button ).insertAfter( last_course );
                    currentOrder.set_courses(new_course_val);
                    currentOrder.reassign_table();

                    self.set_course_button_click();
                });

                self.$el.find('#course_rem').off('click').click(function(){
                    var currentOrder = self.pos.get('selectedOrder');
                    var current_courses = self.$el.find('.course-button');
                    var last_course = current_courses.get( -1 );
                    var last_course_val = last_course.attributes.course.nodeValue;
                    var new_course_val = parseInt(last_course_val) - 1;

                    if ( parseInt(last_course_val) > 1 ){
                        $( last_course ).remove();
                        currentOrder.set_courses(new_course_val);
                        currentOrder.reassign_table();
                    }
                });
                self.set_course_button_click();
            });

        },

        set_course_button_click: function(){
            var self = this;
            var order = this.pos.get('selectedOrder');
            self.$el.find('button.course-button').off('click').click(function(){
                if (!($(this).hasClass("course_selected"))) {
                    _.each(self.$el.find('.course-button'), function(course_button){
                        if ($(course_button).hasClass("course_selected")) {
                            $(course_button).removeClass("course_selected");
                        }
                    });
                    $(this).addClass("course_selected");
                    order.set_current_course(parseInt(this.attributes.course.nodeValue));
                    order.reassign_table();
                }
            });
        },

        set_orderline_seat: function(seat){

            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();
            if (line) {
                line.set_seat(seat);
                line.set_is_lady(false);
            }
        },
        set_orderline_lady_seat: function(seat){

            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();
            if (line) {
                line.set_seat(seat);
                line.set_is_lady(true);
            }
        },
        reset_table_header: function(){

            var self = this;

            var currentOrder = self.pos.get('selectedOrder');

            if (currentOrder.get_tables().length > 0){
                this.pos.tables_loaded.done(function(){

                    self.table_header = self.get_table_header();
                    self.table_seats = self.get_table_seats();

                    self.courses = self.get_curr_courses();

                    self.lady_seats = self.get_lady_seats();

                }).then(function(){
                    self.renderElement();
                });
            }
            else
            {
                this.pos.tables_loaded.done(function(){
                    self.pos_widget.screen_selector.set_current_screen_no_close_popup('selecttable');
                }).then(function(){
                    self.renderElement();
                });
            }
            this.renderElement();
        },
        get_curr_courses: function(){
            var currentOrder = this.pos.get('selectedOrder');
            var current_courses = currentOrder.get_courses();

            if (current_courses > 1){
                var courses = "";
                for ( var course = 1; course <= current_courses; course++ ) {
                    if (course == currentOrder.get_current_course()) {
                        courses += '<button class="course-button table-button course_selected" course='+ course +'>'+ course +'</button>';
                    } else {
                        courses += '<button class="course-button table-button" course='+ course +'>'+ course +'</button>';
                    }
                }
                return courses;
            }
            else{
                return '<button class="course-button table-button course_selected" course=1>1</button>';
                currentOrder.set_current_course(1);
            }
        },
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

        get_table_seats: function(){
            var currentOrder = this.pos.get('selectedOrder');

            var seats=currentOrder.get_seats();

            var seat_bar = '';
            var count = 1;

            for ( var seat = 1; seat <= seats; seat++ ) {
                seat_bar+='<button class="seat-button table-button" seat="'+seat+'">'+seat+'</button>'
            }
            return seat_bar;
        },

        get_lady_seats: function(){
            var currentOrder = this.pos.get('selectedOrder');

            var seats=currentOrder.get_seats();

            var seat_bar = '';
            var count = 1;

            for ( var seat = 1; seat <= seats; seat++ ) {
                seat_bar+='<button class="lady-button table-button" seat="'+seat+'">L'+seat+'</button>'
            }

            return seat_bar;
        }
	});

    module.ProductScreenWidget = module.ProductScreenWidget.extend({
        start: function(){
            var self = this;
            this.product_list_widget = new module.ProductListWidget(this,{

                click_product_action: function(product) {
                    var currentOrder = self.pos.get('selectedOrder');
                    var seats = currentOrder.get_seats();

                    if (seats > 1){
                        self.pos.get('selectedOrder').addProduct(product);
                        self.pos_widget.screen_selector.show_popup('SetSeatPopup');
                    } else {
                        if (product.is_customizable) {
                            self.pos.get('selectedOrder').temp_line_prod = product;
                            self.pos_widget.screen_selector.show_popup('modifierspopup');
                            $("input[id=done_action]").val("add");
                        }
                        else {
                            self.pos.get('selectedOrder').addProduct(product);
                        }
                    }
                }
            });
            this.product_list_widget.replace($('.placeholder-ProductListWidget'));

            this.product_categories_widget = new module.ProductCategoriesWidget(this,{
                product_list_widget: this.product_list_widget,
            });
            this.product_categories_widget.replace($('.placeholder-ProductCategoriesWidget'));

            //Grover Notes:
            //Added from my module
            this.table_header_widget = new module.TableHeaderWidget(this,{});
            this.table_header_widget.replace($('.placeholder-TableHeaderWidget'));
        },
        show: function(){
            this._super();
            this.table_header_widget.reset_table_header();
        }
    });

    module.InternalMessagePopup = module.PopUpWidget.extend({
        template:'InternalMessagePopup',
        init: function(parent, options) {
            this._super(parent, options);
        },
        show: function(){
            var self = this;

            self._super();
            self.renderElement();

            var currentOrder = this.pos.get('selectedOrder');

            this.$el.find('#im_set').off('click').click(function(){
                currentOrder.set_internal_message(self.$el.find('#internal_message').val());
                currentOrder.reassign_table();
                self.pos_widget.screen_selector.close_popup();
            });

            this.$el.find('#im_cancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        },
    });

    module.SetSeatPopup = module.PopUpWidget.extend({
        template:'SetSeatPopup',
        init: function(parent, options) {
            this._super(parent, options);
            this.messages = [];
        },
        show: function(){
            var self = this;
            self.table_seats = self.get_table_seats();
            self.lady_seats = self.get_lady_table_seats();

            self._super();
            self.renderElement();
        },
        get_table_seats: function(){
            var currentOrder = this.pos.get('selectedOrder');

            var seats=currentOrder.get_seats();

            var seat_bar = '';
            var count = 1;

            for ( var seat = 1; seat <= seats; seat++ ) {
                seat_bar+='<button class="seat-button table-button" seat="'+seat+'">'+seat+'</button>'
            }

            return seat_bar;
        },
        get_lady_table_seats: function(){
            var currentOrder = this.pos.get('selectedOrder');

            var seats=currentOrder.get_seats();

            var seat_bar = '';
            var count = 1;

            for ( var seat = 1; seat <= seats; seat++ ) {
                seat_bar+='<button class="lady-button table-button" seat="'+seat+'">L'+seat+'</button>'
            }

            return seat_bar;
        },
        renderElement: function(){
            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();

            $.when(this._super()).then(function(){
                self.$el.find('.seat-button').off('click').click(function(){
                    seat_selected=$(this).attr('seat');
                    self.set_orderline_seat(seat_selected);
                    self.pos_widget.screen_selector.close_popup();
                    var product = line.product;
                    if (product.is_customizable) {
                        self.pos.get('selectedOrder').temp_line_prod = product;
                        self.pos_widget.screen_selector.show_popup('modifierspopup');
                        $("#notes_text").val(line.order_line_notes);
                        _.each($("tr"), function(tr_found){
                            _.each(line.product_ids, function(modif_sel){
                                if (tr_found.id == modif_sel){
                                    $(tr_found).removeClass("tr_sel_false");
                                    $(tr_found).addClass("tr_sel_true");
                                }
                            });
                        });
                        $("input[id=done_action]").val("edit");
                    }
                });
                self.$el.find('.lady-button').off('click').click(function(){
                    seat_selected=$(this).attr('seat');
                    self.set_orderline_lady_seat(seat_selected);
                    self.pos_widget.screen_selector.close_popup();
                    var product = line.product;
                    if (product.is_customizable) {
                        self.pos.get('selectedOrder').temp_line_prod = product;
                        self.pos_widget.screen_selector.show_popup('modifierspopup');
                        $("#notes_text").val(line.order_line_notes);
                        _.each($("tr"), function(tr_found){
                            _.each(line.product_ids, function(modif_sel){
                                if (tr_found.id == modif_sel){
                                    $(tr_found).removeClass("tr_sel_false");
                                    $(tr_found).addClass("tr_sel_true");
                                }
                            });
                        });
                        $("input[id=done_action]").val("edit");
                    }
                });
                self.$el.find('#seatsCancel').off('click').click(function(){
                    var order = self.pos.get('selectedOrder');
                    var line = order.getSelectedLine();

                    self.pos.get('selectedOrder').removeOrderline(line);
                    self.pos_widget.screen_selector.close_popup();
                });
            });

        },
        set_orderline_seat: function(seat){

            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();
            if (line) {
                line.set_seat(seat);
                line.set_is_lady(false);
            }
        },
        set_orderline_lady_seat: function(seat){

            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();
            if (line) {
                line.set_seat(seat);
                line.set_is_lady(true);
            }
        },
    });

    module.ModifiersWidget = module.PopUpWidget.extend({
        template:'Modifiers',
        init: function(parent, options) {
            this._super(parent, options);
            this.properties_modifiers=[];
        },
        show: function(){
            var self = this;
            var product = self.pos.get('selectedOrder').temp_line_prod;

            // "this.properties_modifiers" used in Q-Web
            this.properties_modifiers = self.get_properties_modifiers(product);

            this._super();
            this.renderElement();

            if (product.property_ids.length == 0) {
                $(".popup_modifiers").css("height", "300px");
            } else{
                $(".popup_modifiers").css("height", "700px");
            }

            this.$el.find('.tr_sel_false').off('click').click(function(){

                $('.message_box').hide();

                var className = $(this).attr('class').trim().split(' ');
                if (className.length > 1 && $(this).hasClass('tr_sel_false')){
                    className = '.' + className[0];
                    _.each(self.$el.find(className), function(tr_found) {
                        $(tr_found).removeClass("tr_sel_true");
                        $(tr_found).addClass("tr_sel_false");
                    });
                }
                $(this).toggleClass("tr_sel_true");
                $(this).toggleClass("tr_sel_false");

            });

            this.$el.find('#btnDone').off('click').click(function(){
                self.done_click(product);
            });

            this.$el.find('#btnCancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        },
        get_properties_modifiers: function(product){
            var self = this;
            var final_property = [];
            var sub_property = [];
            if (product.property_ids && product.property_ids.length) {
                _.each(self.pos.get('property'), function(prop){
                    find_prop = _.filter(product.property_ids, function(num){return num == prop.id;});
                    if (find_prop && find_prop.length) {
                        var attributes = [];
                        var pro_id=self.pos.get('property_rel');
                        _.each(pro_id, function(prods){
                            if (prods.property_id[0] == find_prop){
                                product_attr=self.pos.db.get_product_by_id(prods.product_id[0]);
                                if (product_attr){
                                    attributes.push({
                                        'name': product_attr.name,
                                        'id': String(prop.id) + "_" + String(product_attr.id),
                                        'price': product_attr.list_price,
                                        'image': product_attr.image_small,
                                        'checked': false
                                    })
                                }
                            }
                        });
                        var tmp_obj = {};
                        tmp_obj[prop.name] = {'single': prop.single_choice, 'attirbute': attributes};

                        sub_property.push(tmp_obj);
                        final_property.push(sub_property);
                        sub_property = [];
                    }
                });
                if (sub_property && sub_property.length) {
                    final_property.push(sub_property);
                }
                return final_property;
            }
            else{
                return false;
            }
        },
        done_click: function(product) {

            var self = this;
            var descrip = "";
            var order_line_notes = "";
            var price = product.list_price;
            var product_ids = []

            this.$el.find('#notes_text').each(function(){
                order_line_notes = this.value;
            }),

            this.$el.find('.tr_sel_true').each(function(){
                var modifName = $(this).find('.modifName').text().trim();
                var modifPrice = $(this).find('.modifPrice').text().trim();

                var modifPriceNumber = modifPrice.replace(/[^\d\.]/g, '');
                modifPriceNumber = parseFloat(modifPriceNumber);

                descrip += modifName +', ';
                price += modifPriceNumber;
                product_ids.push(this.id);
            });

            if(descrip){
                descrip = descrip.slice(0,-2)
            }

            ol_opts = {
                price: price,
                descrip: descrip,
                order_line_notes: order_line_notes,
                product_ids: product_ids,
            }

            var done_action = $("input[id=done_action]").val();

            switch (done_action) {
                case "add":
                    self.pos.get('selectedOrder').addProduct(product, ol_opts);
                    self.pos_widget.screen_selector.close_popup();
                break;
                case "edit":
                    var order = this.pos.get('selectedOrder');
                    var line = order.getSelectedLine();

                    line.set_property_desc(ol_opts.descrip);
                    line.set_notes(ol_opts.order_line_notes);
                    line.set_unit_price(ol_opts.price);
                    line.set_product_ids(ol_opts.product_ids);

                    self.pos_widget.$('.order-submit').addClass('highlight');
                    self.pos_widget.screen_selector.close_popup();
                break;
                case "view_mode":
                    $('.message_box_text').html(
                        "line already printed or prepared at kitchen"
                    );
                    $('.message_box').show();
                break;
            }
        },
    });

    module.ProductCategoriesWidget = module.ProductCategoriesWidget.extend({
        renderElement: function(){
            var self = this;

            var el_str  = openerp.qweb.render(this.template, {widget: this});
            var el_node = document.createElement('div');
                el_node.innerHTML = el_str;
                el_node = el_node.childNodes[1];

            if(this.el && this.el.parentNode){
                this.el.parentNode.replaceChild(el_node,this.el);
            }

            this.el = el_node;

            var hasimages = false;  //if none of the subcategories have images, we don't display buttons with icons
            for(var i = 0; i < this.subcategories.length; i++){
                if(this.subcategories[i].image){
                    hasimages = true;
                    break;
                }
            }

            var list_container = el_node.querySelector('.category-list');
            for(var i = 0, len = this.subcategories.length; i < len; i++){
                list_container.appendChild(this.render_category(this.subcategories[i],hasimages));
            };

            var buttons = el_node.querySelectorAll('.js-category-switch');
            for(var i = 0; i < buttons.length; i++){
                buttons[i].addEventListener('click',this.switch_category_handler);
            }

            //MARCO notes:
            // Here "products" filters modifiers (the ones with no "public category")
            var all_products = this.pos.db.get_product_by_category(this.category.id);
            var products = _.filter(all_products, function(prods){ return prods.public_categ_id !== false; });

            this.product_list_widget.set_product_list(products);

            this.el.querySelector('.searchbox input').addEventListener('keyup',this.search_handler);

            this.el.querySelector('.search-clear').addEventListener('click',this.clear_search_handler);

            if(this.pos.config.iface_vkeyboard && this.pos_widget.onscreen_keyboard){
                this.pos_widget.onscreen_keyboard.connect($(this.el.querySelector('.searchbox input')));
            }
        },
    });

    module.CashierLoginPopupWidget = module.CashierLoginPopupWidget.extend({
        on_session_changed: function(old_user, new_user){
            var self = this;
            this._super(old_user,new_user);
            $.when(this.pos.synchorders.set_flag_to_remove_all_orders()).then(
                self.pos.synchorders.remove_orders()
            );
            this.pos.reload_user_tables(new_user);
            this.pos_widget.select_table_screen.change_active_user(new_user);
        },
    });

    module.SP_Widget = module.PopUpWidget.extend({
        template:'SP_Widget',
        init: function(parent, options) {
            this._super(parent, options);
            this.sp_reasons = this.get_reasons(); //this is for xml template
        },

        show: function(){
            this._super();
            this.renderElement();

            var self = this;

            var currentOrder = self.pos.get('selectedOrder');

            if (currentOrder.sp_reason) {
                self.pos_widget.screen_selector.close_popup();
                self.validate_order().then (function(){
                    if (currentOrder.authorization.approved) {
                        self.sp_close_order();
                    }
                });
            }

            self.buttons_actions();

            this.$el.find('.tr_sel_false').off('click').click(function(){

                // single choice:
                _.each(self.$el.find(".tr_sel_true"), function(tr_found) {
                    $(tr_found).removeClass("tr_sel_true");
                    $(tr_found).addClass("tr_sel_false");
                });

                $(this).toggleClass("tr_sel_true");
                $(this).toggleClass("tr_sel_false");
            });

        },
        buttons_actions: function(){
            var self = this;

            self.$el.find('#sp_apply').off('click').click(function(){
                var currentOrder = self.pos.get('selectedOrder');
                var reason_id = "";
                var reason_txt = "";
                currentOrder.sp_reason_txt = false;

                _.each(self.$el.find(".tr_sel_true"), function(tr_found) {
                    reason_id = $(tr_found).attr('id');
                    reason_txt = $(tr_found).attr('txt');
                    currentOrder.sp_reason = reason_id;
                    currentOrder.sp_reason_txt = reason_txt;
                });

                if (reason_id == ""){
                    alert ("You need to specify a reason for S&P");
                    return;
                }

                (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), reason_id).then(function(){
                    var cashregister = [];
                    return (new instance.web.Model('pos.order')).get_func('fetch_sp_journal_id')();
                }).then(function(sp_id) {
                    _.each(self.pos.bankstatements, function(bank_st){
                        if(bank_st.journal_id[0] == sp_id){
                            cashregister = bank_st;
                        }
                    });
                }).then (function(){
                    return self.validate_order();
                }).then (function(){
                    if (currentOrder.authorization.approved) {
                        self.sp_close_order();
                    }
                });
                self.pos_widget.screen_selector.close_popup();
            });

            self.$el.find('#sp_cancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        },

        validate_order: function() {
            var self = this;

            //var realvalidate = this._super;
            var connection = new openerp.Session(self, null, {session_id: openerp.session.session_id});
            var currentOrder = self.pos.get('selectedOrder');
            return connection.rpc('/poi_pos_auth_approval/check_validate_order',
                {
                    'config_id': self.pos.config.id,
                    'order_id': currentOrder.get_order_id(),
                    'current_order': [currentOrder.export_as_JSON()]
                }).then(function(authorization){
                    currentOrder.authorization = authorization;
                    if(!authorization.approved){
                        self.pos_widget.screen_selector.show_popup('ApprovalPopup');
                        $("input[id=sp_reason_txt]").val(currentOrder.sp_reason_txt);
                    }
                }
            );
        },

        sp_close_order: function(){
            var self = this;
            var currentOrder = self.pos.get('selectedOrder');

            self.pos.sp_cashregister_id = cashregister.id;
            currentOrder.addPaymentline(cashregister);
            currentOrder.selected_paymentline.set_amount( Math.max(currentOrder.getDueLeft(),0) );
            (new instance.web.Model('pos.order')).get_func('sp_create_from_ui')(currentOrder.export_as_JSON());

            //++++++ PRINT CLOSE TICKET ++++++++++++++
             if(self.pos.config.iface_print_via_proxy){
                var receipt = currentOrder.export_for_printing();
                console.log('XmlReceipt', receipt);
                self.pos.proxy.print_receipt(QWeb.render('XmlReceipt',{
                    receipt: receipt,
                    widget: self
                }));
            }
            //+++++++++++++++++++++++++++++++++++++++++

            //self.pos.authorization.approved = false;
            currentOrder.set_order_tables_state('open');
            currentOrder.destroy({'reason':'abandon'});
        },

        get_reasons: function(){
            var self = this;
            var reasons = [];
            var sp_load = self.pos.fetch(
                'pos.sales.promotions',
                ['reason'],
                []
            ).then(function(db_reasons){
                _.each(db_reasons, function(reason){
                    reasons.push(reason);
                });
            });
            return reasons;
        }
    });

    module.MultipleWidget = module.PopUpWidget.extend({
        template:'MultipleWidget',
        init: function(parent, options) {
            this._super(parent, options);
            this.orderLines=[]; // this is for xml template
            this.KitchenScreen=[];
        },

        show: function(){
            $('.message_box_text').text("");
            $('.message_box').hide();

            var self = this;
            var order = this.pos.get('selectedOrder');
            var lines = order.get_all_lines_sorted();
            lines.reverse();

            var line = order.getSelectedLine();
            this.orderLines = lines; // this is for xml template
            this.KitchenScreen = this.pos.config.kitchen_screen;

            this._super();
            this.renderElement();

            this.$el.find('.tr_sel_false').off('click').click(function(){
                $('.message_box_text').text("");
                $('.message_box').hide();
                $(this).toggleClass("tr_sel_false");
                $(this).toggleClass("tr_sel_true");
            });

            this.$el.find('#multiVoid').off('click').click(function(){

                var remove_highligt = true;
                if (self.pos_widget.$('.order-submit').hasClass('highlight')){
                    remove_highligt = false;
                }

                var selected_rows = self.$el.find('.tr_sel_true');
                var voids = [];
                var not_voidable = false;

                if (selected_rows.length > 0) {
                    _.each(selected_rows, function(sel_row){
                        //Gets Line that corresponds to <TR>
                        sel_line = _.filter(self.orderLines, function(orline){return orline.cid == sel_row.id})[0];
                        if (sel_line.get_sent_to_kitchen()){
                            not_voidable = true;
                        } else {
                            voids.push (sel_line);
                        }
                    });

                    if (not_voidable){
                        $('.message_box_text').html("Cannot void lines printed or sent to kitchen.");
                        $('.message_box').show();
                    } else {
                        _.each (voids, function(line_to_void){
                            order.removeOrderline(line_to_void);

                        });
                        if (remove_highligt){
                            self.pos_widget.$('.order-submit').removeClass('highlight');
                        }

                        self.pos_widget.screen_selector.close_popup();
                    }

                } else {
                    $('.message_box_text').html("No lines selected.");
                    $('.message_box').show();
                }
            });


           /* This block will always allow voids;
              printed lines or sent to kitchen lines will be saved in table REJECTS at DataBase

            this.$el.find('#multiVoid').off('click').click(function(){

                var remove_highligt = true;
                if (self.pos_widget.$('.order-submit').hasClass('highlight')){
                    remove_highligt = false;
                }

                var selected_rows = self.$el.find('.tr_sel_true');
                var voids = [];
                var rejects = [];

                if (selected_rows.length > 0){
                    _.each(selected_rows, function(sel_row){
                        sel_line = _.filter(self.orderLines, function(orline){return orline.cid == sel_row.id})[0]; //Gets Line that corresponds to <TR>
                        voids.push (sel_line);

                        if (sel_line.get_sent_to_kitchen()){
                            if (self.pos.config.kitchen_screen){
                                if (sel_line.order_line_state_id[0] > 1){
                                    rejects.push (sel_line.export_as_JSON());
                                }
                            } else {
                                rejects.push (sel_line.export_as_JSON());
                            }
                        }
                    });

                    // actions in pos interface
                    _.each (voids, function(line_to_void){
                        order.removeOrderline(line_to_void);
                    });


                    // actions in kitchen
                    if (rejects.length > 0){

                        // Copy line to "rejected lines" table
                        (new instance.web.Model('pos.order')).get_func('reject_line_from_ui')([rejects], order.get_order_id());

                        // Remove line from current order
                        (new instance.web.Model('pos.order')).get_func('remove_kitchen_from_ui')(rejects);
                    }

                    if (remove_highligt){
                        self.pos_widget.$('.order-submit').removeClass('highlight');
                    }

                    self.pos_widget.screen_selector.close_popup();
                } else {
                    $('.message_box_text').html("No lines selected.");
                    $('.message_box').show();
                }
            }); */

            this.$el.find('#multiDuplicate').off('click').click(function(){
                var currentOrder = self.pos.get('selectedOrder');
                var selected_tr = self.$el.find('.tr_sel_true');

                if (selected_tr.length > 0){
                    _.each(selected_tr, function(sel_tr){
                        dup_line = _.filter(lines, function(ol){return ol.cid == sel_tr.id})[0];

                        ol_opts = {
                            quantity: dup_line.get_quantity(),
                            price: (dup_line.get_price_without_tax())/(dup_line.get_quantity()),
                            discount: dup_line.get_discount(),
                            descrip: dup_line.get_property_desc(),
                            order_line_notes: dup_line.get_notes(),
                            product_ids: dup_line.get_product_ids(),
                            seat: dup_line.get_seat(),
                            course: dup_line.get_sequence()
                        }
                        currentOrder.addProduct(dup_line.product, ol_opts);
                    });
                }
                self.pos_widget.screen_selector.close_popup();
            });


          /* This block if for REPEAT which means the line quty will be increased
             within the line itself

            this.$el.find('#multiRepeat').off('click').click(function(){

                var selected_tr = self.$el.find('.tr_sel_true');
                var repeat_line = true;

                if (selected_tr.length > 0){
                    _.each(selected_tr, function(sel_tr){
                        rep_line = _.filter(lines, function(ol){return ol.cid == sel_tr.id})[0];
                        console.log("REPLINE",rep_line.get_sent_to_kitchen());
                        if (rep_line.get_sent_to_kitchen()){
                            if (self.pos.config.kitchen_screen){
                                if (rep_line.order_line_state_id[0] > 1){
                                    repeat_line = false;
                                }
                            }
                        }

                        switch (repeat_line){
                            case true: //creates new line because current one can't be edited
                                rep_line.set_quantity(rep_line.quantity + 1);
                                self.pos_widget.screen_selector.close_popup();
                            break;
                            case false:
                                $('.message_box_text').html("This line cannot be edited; you may use Duplicate instead.");
                                $('.message_box').show();
                            break;
                        }
                    });
                }
                else{
                    $('.message_box_text').html("No lines selected.");
                    $('.message_box').show();
                }
            });
          */

            this.$el.find('#multiCancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        }
    });

    module.OrderLineOptionsWidget = module.PopUpWidget.extend({
        template:'OrderLineOptionsWidget',
        show: function(){
            $('.message_box_text').text("");
            $('.message_box').hide();

            this._super();
            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();
            var product = line.product;

            this.$el.find('#btnDup').off('click').click(function(){

                ol_opts = {
                    quantity: line.get_quantity(),
                    price: (line.get_price_without_tax())/(line.get_quantity()),
                    discount: line.get_discount(),
                    descrip: line.get_property_desc(),
                    order_line_notes: line.get_notes(),
                    product_ids: line.get_product_ids(),
                    seat: line.get_seat(),
                    course: line.get_sequence()
                };
                self.pos.get('selectedOrder').addProduct(product, ol_opts);

                self.pos_widget.screen_selector.close_popup();
            });

            this.$el.find('#btnEdit').off('click').click(function(){
                var edit_validate = true;
                var show_modif_popup = true;


                /* THIS BLOCK WON'T SHOW POPUP FOR "product.is_customizable == false"
                if (product.is_customizable) {
                    if (line.get_sent_to_kitchen()){
                        if (self.pos.config.kitchen_screen){
                            if (line.order_line_state_id[0] > 1){
                                edit_validate = false;
                            }
                        } else {
                            edit_validate = false;
                        }
                    }
                } else {
                    show_modif_popup = false;
                    $('.message_box_text').text("This product is not customizable.");
                    $('.message_box').show();
                } */

                if (line.get_sent_to_kitchen()){
                    if (self.pos.config.kitchen_screen){
                        if (line.order_line_state_id[0] > 1){
                            edit_validate = false;
                        }
                    } else {
                        edit_validate = false;
                    }
                }

                if (show_modif_popup) {
                    self.pos.get('selectedOrder').temp_line_prod = product;
                    self.pos_widget.screen_selector.show_popup('modifierspopup');
                    $("#notes_text").val(line.order_line_notes);
                    _.each($("tr"), function(tr_found){
                        _.each(line.product_ids, function(modif_sel){
                            if (tr_found.id == modif_sel){
                                $(tr_found).removeClass("tr_sel_false");
                                $(tr_found).addClass("tr_sel_true");
                            }
                        });
                    });

                    if (!edit_validate) {
                        $("input[id=done_action]").val("view_mode");
                    } else {
                        $("input[id=done_action]").val("edit");
                    }
                }
                
            });

            this.$el.find('#btnCancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        }
    });

	module.SelectSequenceWidget = module.PopUpWidget.extend({
        template:'SelectSequenceWidget',
        show: function(){
            this._super();
            var self = this;
            var order = this.pos.get('selectedOrder');
            var line = order.getSelectedLine();

            this.$el.find('input.sequence-text').val('');

            this.$el.find('#cancel_sequence').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });

            this.$el.find('#change_sequence').off('click').click(function(){
                var new_sequence = Number(self.$el.find('input.sequence-text').val());
                line.set_sequence(new_sequence);
                self.pos_widget.screen_selector.close_popup();
            });


            /*
            this.$el.find('input.sequence-text').off('keyup').keyup(function(){
                var pin = Number(self.$el.find('input.pin_code').val());
                    if (self.$el.find('input.pin_code').val().length>=4){
                        if(self.validatePIN(pin)){
                            self.$el.find('input.pin_code').val('');
                            self.pos_widget.screen_selector.close_popup();
                            self.pos.session_locked=false;
                        }
                        else{
                            self.$el.find('input.pin_code').val('');
                            // self.$el.find('input.pin_code').focus();
                        };
                    }
            });*/

            this.$el.find('.seq-numpad-backspace').off('click').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.seq-number-char').off('click').click(_.bind(this.clickAppendNewChar, this));

            // self.$el.find('input.sequence-text').focus();

        },
        clickDeleteLastChar: function() {
            old_sequence=this.$el.find('input.sequence-text').val();
            this.$el.find('input.sequence-text').val(old_sequence.slice(0,-1));
        },
        clickAppendNewChar: function(event) {
            var newChar;
            newChar = event.currentTarget.innerText || event.currentTarget.textContent;

            old_sequence=this.$el.find('input.sequence-text').val();
            this.$el.find('input.sequence-text').val(old_sequence+newChar);
            this.$el.find('input.sequence-text').trigger('keyup');
        },
        close:function(){

        },
    });

    module.OrderWidget = module.OrderWidget.extend({
        render_orderline: function(orderline){
            var self = this;
            var result = this._super(orderline);
            $(result).find('.orderline-sequence-action').off('click').click(function(){
                self.pos_widget.screen_selector.show_popup('selectsequencepopup');
            });
            $(result).find('.orderline-options-action').off('click').click(function(){
                self.pos_widget.screen_selector.show_popup('orderlineoptionspopup');
            });
            return result;
        },
    });

    module.OrderSelectorButtonWidget = module.OrderSelectorButtonWidget.extend({
        on_order_built: function(order_id){
            this._super(order_id);
            var self = this;
            //$.when(this.pos.synchorders.set_flag_to_remove_other_orders(order_id)).then(self.pos.synchorders.remove_orders());
        },
        get_amount_total: function(){
            var amount_total = parseFloat(this.order.amount_total);
            return amount_total.toFixed(2) || 0;
        },
    });

    module.MergeOrderButtonWidget = module.MergeOrderButtonWidget.extend({
        get_amount_total: function(){
            var amount_total = parseFloat(this.order.amount_total);
            return amount_total.toFixed(2) || 0;
        },
    });


    module.PosWidget = module.PosWidget.extend({
        init: function(parent, options) {
            this._super(parent, options);
            var  self = this;
        },
        start: function(){
            var self = this;
            self._super();
        },

        build_widgets: function() {
            var self = this;
            this._super();

            //hide button [+/-] of numpad
            $(".data-mode-minus").css("visibility", "hidden");


            this.select_sequence_popup = new module.SelectSequenceWidget(this, {});
            this.select_sequence_popup.appendTo(this.$el);

            this.select_table_screen = new module.SelectTableScreenWidget(this, {});
            this.select_table_screen.appendTo(this.$('.screens'));

            this.screen_selector.add_popup('selectsequencepopup',this.select_sequence_popup);
            //this.screen_selector.add_popup('selecttablepopup',this.select_table_popup);
            this.screen_selector.add_screen('selecttable',this.select_table_screen);

            //Creating Pop-up "ModifiersWidget"
            this.modifiers_popup = new module.ModifiersWidget(this, {});
            this.modifiers_popup.appendTo(this.$el);
            this.screen_selector.add_popup('modifierspopup',this.modifiers_popup);

            //Creating Pop-up "build_widgetsWidget"
            this.multiple_popup = new module.MultipleWidget(this, {});
            this.multiple_popup.appendTo(this.$el);
            this.screen_selector.add_popup('multiplepopup',this.multiple_popup);

            //Creating Pop-up "SP_Widget"
            this.sp_popup = new module.SP_Widget(this, {});
            this.sp_popup.appendTo(this.$el);
            this.screen_selector.add_popup('sppopup',this.sp_popup);

            //Creating Pop-up "OrderLineOptionsWidget"
            this.order_line_options_popup = new module.OrderLineOptionsWidget(this, {});
            this.order_line_options_popup.appendTo(this.$el);
            this.screen_selector.add_popup('orderlineoptionspopup',this.order_line_options_popup);

            //Creating Pop-up "SetSeatPopup"
            this.set_seat_popup = new module.SetSeatPopup(this, {});
            this.set_seat_popup.appendTo(this.$el);
            this.screen_selector.add_popup('SetSeatPopup',this.set_seat_popup);

            //Creating Pop-up "InternalMessagePopup"
            this.internal_message_popup = new module.InternalMessagePopup(this, {});
            this.internal_message_popup.appendTo(this.$el);
            this.screen_selector.add_popup('InternalMessagePopup',this.internal_message_popup);

            //this.screen_selector.set_current_screen('selecttable');

            this.propertiesloaddata = new module.PropertiesLoadData(this, {});

                // Hide Tabs for orders and button to delete orders
                // Now users have button "ORDERS"
                //$(".deleteorder-button").hide();
                //$(".orders").hide();

            /*var sendtokitchen = $(QWeb.render('SendToKitchenButton'));

            sendtokitchen.click(function(){
                var currentOrder = self.pos.get('selectedOrder');
                var lines = currentOrder.attributes.orderLines.models;
                if(lines == ''){
                    alert('There are no lines to be sent.');
                }
                else{
                    (new instance.web.Model('pos.order')).get_func('send_to_kitchen_from_ui')([currentOrder.exportAsJSON()]).then(function(order_id){
                        currentOrder.attributes.id = order_id[0];
                        for( idx in lines ){
                            lines[idx].id = order_id[1][idx];
                        }
                        currentOrder.set_order_tables_state('order_taken');
                        alert('Order sent to kitchen successfully!');
                    });
                }
            });

            sendtokitchen.appendTo(this.$('.table-header-buttons'));*/

            var multiplebutton = $(QWeb.render('MultipleButton'));

            multiplebutton.click(function(){
                var lines = self.pos.get("selectedOrder").get_all_lines();
                if(lines == ''){
                    alert('There are no lines to select.');
                }
                else{
                    self.pos_widget.screen_selector.show_popup('multiplepopup');
                }
            });

            multiplebutton.appendTo(this.$('.control-buttons'));

            var SPbutton = $(QWeb.render('SPbutton'));

            SPbutton.click(function(){
                var order_lines = self.pos.get('selectedOrder').get_all_lines();
                var allow_popup = true;
                 _.each(order_lines, function(line){
                     if (!line.sent_to_kitchen){
                         allow_popup = false
                     }
                 });

                if (order_lines.length && allow_popup) {
                    var currentOrder = self.pos.get('selectedOrder');
                    self.get_auth().then(function() {

                            if (currentOrder.authorization.state != 'none') {
                                if (confirm("Your authorization process will be lost. Continue?")) {
                                    (new instance.web.Model('pos.order')).get_func('sp_execute')(currentOrder.get_order_id(), 'back')
                                        .then(function () {
                                            self.pos_widget.screen_selector.show_popup('sppopup');
                                        });
                                }
                            } else self.pos_widget.screen_selector.show_popup('sppopup');

                    });
                }
                else if (!order_lines.length)
                    alert("The order has no lines.");
                else if (!allow_popup)
                    alert("Some order-lines were not printed yet.");
            });

            SPbutton.appendTo(this.$('.control-buttons'));

            this.$('.control-buttons').removeClass('oe_hidden');

            $.when(self.pos.synchorders.set_flag_to_remove_all_orders()).then(function(){
                self.pos.synchorders.set_domain([['id','<',0]]);
                self.pos_widget.order_selector_screen.set_domain([['id','<',0]]);
                //self.pos.synchorders.connect();
                self.pos_widget.order_selector_screen.connect();
            });
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