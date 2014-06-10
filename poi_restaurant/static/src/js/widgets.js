// ******************* DAO SYSTEMS LA ********************************************
function openerp_restaurant_widgets(instance, module) { //module is instance.point_of_sale
    var QWeb = instance.web.qweb;
    var _t = instance.web._t;

    module.PayButton = module.PosBaseWidget.extend({
        template: 'PayButtonDao',
        init: function (parent, options) {
            this._super(parent, options);
        },
        renderElement: function () {
            var self = this;
            this._super();

            this.$el.click(function () {

                self.pos_widget.screen_selector.show_popup('MyPaymentSplit');
            });

        },
    });

    // The paypad allows to select the payment method (cashregisters)
    // used to pay the order.
    module.PaypadWidget = module.PaypadWidget.extend({
        template: 'PaypadWidget',
        renderElement: function () {
            var self = this;
            //llamar a la Base, ya q la base tiene la logica no solamente tiene la logica de agregar estos botones, sino como guardar un espacio para estos
            this._super();

            //Ocultar los botones, no queremos verlos, ahora habra un solo botón
            self.$('.paypad-button').addClass('oe_hidden');


            var button2 = new module.PayButton(self, {
                pos: self.pos,
                pos_widget: self.pos_widget,
                cashregister: self.cashregister,
            });

            //console.log("THIS", this);
            //console.log('button2', button2);

            button2.appendTo(self.$el);
        }
    });

    module.MyPaymentSplit = module.PopUpWidget.extend({
        template: 'MyPaymentSplit',
        init: function (parent, options) {
            this._super(parent, options);
            this.messages = [];
        },

        show: function () {
            $('.message_box_text').text("");
            $('.message_box').hide();

            this._super();
            var self = this;


            this.$el.find('#btnSplitEvenly').off('click').click(function () {

                var Qty = $(this).parent().parent().find('#splitNumber').val();

                var dueTotal = self.pos.get('selectedOrder').getTotalTaxIncluded();

                var singlePaymet = (dueTotal / Qty).toFixed(2);

                var aux = 0;

                var difference = 0;

                var o = self.pos.get('selectedOrder');

                var paymentLines = o.attributes.paymentLines;

                //console.log('Antes en el botonSELF selectedOrder',self.pos.get('selectedOrder'));

                // console.log('o',o);


                for (var i = (paymentLines.length - 1); i >= 0; i--) {
                    o.removePaymentline(paymentLines.models[i]);
                };

                if (isNaN(Qty) || Qty <= 0) {
                    Qty = 1;
                };

                for (var i = 0; i < Qty; i++) {

                    //Estamos pasandole por defecto un cashregister.... para evitar el error.

                    self.pos.get('selectedOrder').addPaymentline(self.pos.cashregisters[0]);

                };

                $(this).parent().parent().find('#splitNumber').val("1");


                self.pos_widget.screen_selector.set_current_screen('payment');





                //console.log(' en el boton SELF selectedOrder',self.pos.get('selectedOrder'));

                //console.log('paymentLines',self.pos.get('selectedOrder')._previousAttributes.paymentLines);



                //setting the payment lines values

                _.each(paymentLines.models, function (paymentLine) {

                    paymentLine.set_amount(singlePaymet);

                    aux = aux + paymentLine.get_amount();

                    //console.log("PAYMENTLINE",paymentLine);

                });

                // console.log('AUX',aux)

                difference = dueTotal - aux;

                // console.log('DIFFERENCE',difference);

                // console.log('SINGLE +DIFFERENCE',(parseFloat(singlePaymet)+difference));



                //setting the first paymentline to perfectly fullfill de payment

                paymentLines.models[0].set_amount(parseFloat(singlePaymet) + difference);

                //setting the input values for the evenly divided payment

                $('input.dao-amount').val(singlePaymet).first().val(paymentLines.models[0].get_amount().toFixed(2));

                //$('input.dao-amount').first().val(paymentLines.models[0].get_amount());

                //console.log('paymentLines',self.pos.get('selectedOrder')._previousAttributes.paymentLines);

                self.pos_widget.screen_selector.close_popup();

            });

            this.$el.find('#btnDone').off('click').click(function () {

                var o = self.pos.get('selectedOrder');

                var paymentLines = o.attributes.paymentLines;

                for (var i = (paymentLines.length - 1); i >= 0; i--) {

                    o.removePaymentline(paymentLines.models[i]);

                };

                //console.log(' en el boton SELF selectedOrder',self.pos.get('selectedOrder'));


                //Obtener el Valor que haya especificado el usario en el input

                var Qty = $(this).parent().parent().find('#splitNumber').val();

                if (isNaN(Qty) || Qty <= 0) {
                    Qty = 1;
                };


                for (var i = 0; i < Qty; i++) {

                    //Estamos pasandole por defecto un cashregister.... para evitar el error.

                    self.pos.get('selectedOrder').addPaymentline(self.pos.cashregisters[0]);

                };

                $(this).parent().parent().find('#splitNumber').val("1");



                self.pos_widget.screen_selector.set_current_screen('payment');

                self.pos_widget.screen_selector.close_popup();

            });



            this.$el.find('#btnCancel').off('click').click(function () {
                self.pos_widget.screen_selector.close_popup();
            });
        },
    });

    module.PosWidget = module.PosWidget.extend({
        init: function (parent, options) {
            this._super(parent, options);
            var self = this;
        },
        /*start:function(){
            this._super();
            var self= this;
        },*/
        build_widgets: function () {
            var self = this;
            this._super();
            this.my_payment_split = new module.MyPaymentSplit(this, {
                cashregister: self.cashregister
            });
            this.my_payment_split.appendTo(this.$el);
            this.screen_selector.add_popup('MyPaymentSplit', this.my_payment_split);
        }
    });


}