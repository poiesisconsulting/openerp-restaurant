function poi_pos_synch_orders(instance, module){

    var QWeb = instance.web.qweb;
	_t = instance.web._t;

    module.SynchOrders = module.SynchOrders.extend({
        assign_values_to_order: function(order, order_data){
            this._super(order, order_data);
            order.assign_tables(order_data.table_ids);
            order.set_seats(order_data.number_of_seats);
            order.set_order_ref(order_data.name);
            order.set_courses(order_data.courses);
            order.set_internal_message(order_data.internal_message);
            order.set_current_course(order_data.current_course);
            order.set_fired_courses(order_data.fired_courses);
        },
        assign_values_to_orderline: function(orderline, orderline_data){
            this._super(orderline, orderline_data);
            orderline.set_property_desc(orderline_data.property_description);
            orderline.set_notes(orderline_data.order_line_notes);
            orderline.set_product_ids_from_db(orderline_data.product_ids);
            orderline.set_seat(orderline_data.seat);
            orderline.set_sequence(orderline_data.sequence);
            orderline.set_sent_to_kitchen(orderline_data.sent_to_kitchen);
            orderline.set_order_line_state_id(orderline_data.order_line_state_id);
            orderline.set_is_lady(orderline_data.lady);
            //property_description: this.get_property_desc(),
            //        order_line_notes: this.get_notes(),
            //        seats: this.get_seat(),
            //        sequence: this.get_sequence(),
        },
        compare_order_data: function(order, order_data){
            this._super(order, order_data);
            //We need some conditions to do this
            if (order.get_tables() != order_data.table_ids){
                order.assign_tables(order_data.table_ids);
            }
            if (order.get_seats() != order_data.number_of_seats)
            {
                order.set_seats(order_data.number_of_seats);
            }
            if (order.get_order_ref() != order_data.name)
            {
                order.set_order_ref(order_data.name);
            }

            if (order.get_courses() != order_data.courses)
            {
                order.set_courses(order_data.courses);
            }

            if (order.get_current_course() != order_data.current_course)
            {
                order.set_current_course(order_data.current_course);
            }

            if (order.get_fired_courses() != order_data.fired_courses)
            {
                order.set_fired_courses(order_data.fired_courses);
            }

            if (order.geT_internal_message() != order_data.internal_message)
            {
                order.set_internal_message(order_data.internal_message)
            }
        },
        compare_orderline_data: function(orderline, orderline_data){
            this._super(orderline, orderline_data);
            if (orderline.get_property_desc() != orderline_data.property_description)
            {
                orderline.set_property_desc(orderline_data.property_description);
            }
            if (orderline.get_notes() != orderline_data.order_line_notes)
            {
                orderline.set_notes(orderline_data.order_line_notes);
            }
            //ToDo I'm not sure if this is going to work properly
            if (orderline.get_product_ids_from_db() != orderline_data.product_ids)
            {
                orderline.set_product_ids_from_db(orderline_data.product_ids);
            }
            if (orderline.get_seat() != orderline_data.seat)
            {
                orderline.set_seat(orderline_data.seat);
            }
            if (orderline.get_sequence() != orderline_data.sequence)
            {
                orderline.set_sequence(orderline_data.sequence);
            }
            if (orderline.get_sent_to_kitchen() != orderline_data.sent_to_kitchen)
            {
                orderline.set_sent_to_kitchen(orderline_data.sent_to_kitchen);
            }
            if (orderline.get_order_line_state_id() != orderline_data.order_line_state_id)
            {
                orderline.set_order_line_state_id(orderline_data.order_line_state_id);
            }
            if (orderline.get_is_lady() != orderline_data.lady)
            {
                orderline.set_is_lady(orderline_data.lady);
            }
        },
    });
}