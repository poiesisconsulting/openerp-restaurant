function openerp_restaurant_courseprint(instance,module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;


	module.CoursePrintWidget = module.PopUpWidget.extend({
        template:'CoursePrintWidget',
        init: function(parent, options) {
            this._super(parent, options);
            this.course_buttons = [];
        },

        show: function(){
            var self = this;
            var order = this.pos.get('selectedOrder');
            var orderline_courses = [];

            order.get('orderLines').each(function(item){
                var line = item.export_as_JSON();
                orderline_courses.push(line.sequence);
            });

            $.each(orderline_courses, function(i,el){
                if($.inArray(el, self.course_buttons) === -1)
                    self.course_buttons.push(el);
            });

            $.each(self.course_buttons, function(i,el){
                if($.inArray(el, orderline_courses) === -1){
                    self.course_buttons = jQuery.grep(self.course_buttons, function(extra_course) {
                        return extra_course != el;
                    });
                }
            });

            this.course_buttons.sort();

            this._super();
            this.renderElement();

            var fire_times = [];
            var fire_times_str = '';
            _.each(this.$el.find('.fire-course-button'), function(button_found){
                _.each(order.get_fired_courses().split('|'), function(f_course) {
                    if (parseInt(f_course.split('-')[0]) === parseInt($(button_found).attr('data-course'))) {
                        var time = f_course.split('-')[1];
                        var hour = time.split(':')[0];
                        var mins = time.split(':')[1].substr(0, 2);
                        var day_time = time.split(':')[1].substr(2, 2);

                        console.log("time",time);
                        console.log("hour",hour);
                        console.log("mins",mins);
                        console.log("day_time",day_time);

                        fire_times.push(self.set_time_format(hour, mins, day_time));

                        $(button_found).addClass("fired");
                    }
                });

                if (fire_times.length){
                    _.each(fire_times, function(ftime){
                        if (fire_times_str){
                            fire_times_str = fire_times_str + '|' + ftime;
                        } else {
                            fire_times_str = ftime;
                        }

                    });
                    fire_times_str = fire_times_str.slice(-15); //shows last three times
                }
                var id_times = "times_" + $(button_found).attr('data-course')
                $(button_found).html($(button_found).html() + '<br><span id="'+ id_times +'" style="font-size:24px;">' + fire_times_str + '</span>');

                fire_times = [];
                fire_times_str = '';
            });

            this.$el.find('.fire-course-button').off('click').click(function() {
                var this_button = this;

                $('.message_box').hide();

                var button = this;
                var currentOrder = self.pos.get('selectedOrder');
                var courseLines = _.filter(currentOrder.get_all_lines(), function (line) {
                    return line.get_sequence() == parseInt($(button).attr('data-course'))
                });
                var course_to_print = $(this).attr('data-course');

                // Only allow "fire" if lines were sent to kitchen
                var allow_fire = true;
                _.each(courseLines, function (c_line) {
                    if (!(c_line.get_sent_to_kitchen())) {
                        allow_fire = false;
                    }
                });

                if (allow_fire) {

                    var current_time = self.set_time_format();

                    order.printCourseChanges(course_to_print);
                    (new instance.web.Model('pos.order')).get_func('fire_course')(currentOrder.get_order_id(), course_to_print, (current_time).toString());

                    $(this).addClass("fired");

                    var id_span = "#times_" + $(this_button).attr('data-course');
                    if ($(id_span).html() == ''){
                        $(id_span).html((current_time).slice(-15));
                    } else {
                        $(id_span).html(($(id_span).html() + '|' + current_time).slice(-15));
                    }

                    order.set_fired_courses_no_synch(course_to_print);
                    self.pos_widget.screen_selector.close_popup();
                } else {
                    $('.message_box_text').html(
                        "Please send lines to kitchen first."
                    );
                    $('.message_box').show();
                }
            });

            this.$el.find('#courseprintCancel').off('click').click(function(){
                self.pos_widget.screen_selector.close_popup();
            });
        },

        set_time_format: function(hr, mn, day_time){
            var hour = parseInt(hr) || (new Date().getHours()).toString();
            var minutes = parseInt(mn) || (new Date().getMinutes()).toString();

            console.log("set_time_format hour", hour);
            if (hour > 12){
                hour = hour - 12;
                day_time = 'pm';
            }
            console.log("set_time_format hour a", hour);
            hour = hour.toString();
            if (hour.length < 2){
                hour = '0' + hour;
                console.log("set_time_format hour b", hour);
            }

            minutes = minutes.toString();
            if (minutes.length < 2){
                minutes = '0' + minutes;
            }
            return hour + ':' + minutes + day_time;
        }
    });


    module.Order = module.Order.extend({
        computeCourseChanges: function(categories, course){
            var current = this.lineResume();
            var json    = this.export_as_JSON();

            var actual_lines = [];

            for( unique_name in current){
                if (current[unique_name].sequence==course){
                    actual_lines.push(current[unique_name]);
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

                var _actual_lines = [];

                for(var i = 0; i < actual_lines.length; i++){
                    if(product_in_category(actual_lines[i].product_id)){
                        _actual_lines.push(actual_lines[i]);
                    }
                }
                actual_lines = _actual_lines;
            }

            return {
                'actual_lines': actual_lines,
                'course_number': course,
                'tables': this.pos.get_tables_code(json.table_ids),
                'areas': this.pos.get_tables_area_name(json.table_ids),
                'name': json.name  || 'unknown order',
                'number_of_seats': json.number_of_seats || 0,
                'time': this.get_mytime(),
            };
            
        },
        printCourseChanges: function(course){
            var printers = this.pos.printers;
            for(var i = 0; i < printers.length; i++){
                var order_data = this.computeCourseChanges(printers[i].config.product_categories_ids, course);
                if ( order_data['actual_lines'].length > 0){
                    var receipt = QWeb.render('CourseRequestReceipt',{order_data:order_data, widget:this});
                    printers[i].print(receipt);
                }
            }
        },
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            //Creating Pop-up "build_widgetsWidget"
            this.courseprint_popup = new module.CoursePrintWidget(this, {});
            this.courseprint_popup.appendTo(this.$el);
            this.screen_selector.add_popup('courseprintpopup',this.courseprint_popup);

            if(this.pos.printers.length){

                var courseorder = $(QWeb.render('CourseOrderButton'));

                courseorder.click(function(){
                    var lines = self.pos.get("selectedOrder").get_all_lines();
                    if(lines == ''){
                        alert('There are no lines to send.');
                    }
                    else{
                        self.pos_widget.screen_selector.show_popup('courseprintpopup');
                    }
                });
                
                courseorder.appendTo(this.$('.control-buttons'));
            }
        },
        
    });

}
