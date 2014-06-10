openerp.poi_pos_cashier_lock = function(instance){

    var module = instance.point_of_sale;
    var QWeb = instance.web.qweb;

	_t = instance.web._t;

    module.PosDB = module.PosDB.extend({
        init: function(options){
            this._super(options);
            this.cashier_by_id = {};
            this.cashier_by_pin = {};
        },
        add_cashiers: function(cashiers){
            var self = this;

            if(!cashiers instanceof Array){
                cashiers = [cashiers];
            }

            for(var i = 0, len = cashiers.length; i < len; i++){
                this.cashier_by_id[cashiers[i].id] = cashiers[i];
                this.cashier_by_pin[cashiers[i].pos_pin] = cashiers[i];
            }
        },
        get_cashier_by_id: function(id){
            return this.cashier_by_id[id];
        },
        get_cashier_by_pin: function(pin){
            if(this.cashier_by_pin[pin]){
                return this.cashier_by_pin[pin];
            }
            return undefined;
        },
    });

    var OldPosModel = module.PosModel;

    module.PosModel = module.PosModel.extend({
        load_server_data: function(){
            var self = this;
            var loaded = OldPosModel.prototype.load_server_data.call(this)
                .then(function(){
                    return self.fetch('res.users',['name','pos_pin'],[['pos_pin', '!=', false]]);
                }).then(function(users){
                    self.db.add_cashiers(users);
                    self.users = users;
                });
            return loaded;
        },
    });

	module.CashierLoginPopupWidget = module.PopUpWidget.extend({
        template:'CashierLoginPopupWidget',
        show: function(){
            this._super();
            var self = this;

            this.pin_code='';

            //This stores the old_user
            if (this.pos.cashier) {
                this.actual_user = this.pos.cashier.id;
            }
            else{
                this.actual_user = this.pos.user.id;
            }

            //This flag is going to avoid multiple popups
            //It seems that system doesn't allow same popups all the time =D

            this.last_screen = self.pos_widget.screen_selector.get_current_screen();
            this.pos.session_locked=true;

            this.$el.find('input.pin_code').off('keyup').keyup(function(){
                var pin = Number(self.$el.find('input.pin_code').val());
                    if (self.$el.find('input.pin_code').val().length>=4){
                        if(self.validatePIN(pin)){
                            self.$el.find('input.pin_code').val('');
                            self.pos_widget.screen_selector.close_popup_overall();
                            self.pos.session_locked=false;
                            self.pos_widget.screen_selector.set_current_screen(self.last_screen, null, 'refresh');
                        }
                        else{
                            self.$el.find('.popup').effect('shake');
                            self.$el.find('input.pin_code').val('');
                            //self.$el.find('input.pin_code').focus();
                        };
                    }
            });

            var flag = false;

            this.$el.find('.pin-numpad-backspace').unbind('touchstart click').bind('touchstart click',function(){
                if (!flag) {
                    flag = true;
                    setTimeout(function(){ flag = false; }, 200);
                    self.clickDeleteLastChar();
                }
            });
            this.$el.find('.pin-number-char').unbind('touchstart click').bind('touchstart click',function(ev){
                if (!flag) {
                    flag = true;
                    setTimeout(function(){ flag = false; }, 200);
                    self.clickAppendNewChar(ev);
                }
            });

            //self.$el.find('input.pin_code').focus();
        },
        clickDeleteLastChar: function() {
            old_pin=this.$el.find('input.pin_code').val();
            this.$el.find('input.pin_code').val(old_pin.slice(0,-1));
        },
        clickAppendNewChar: function(event) {
            var newChar;
            newChar = event.currentTarget.innerText || event.currentTarget.textContent;

            old_pin=this.$el.find('input.pin_code').val();
            this.$el.find('input.pin_code').val(old_pin+newChar);
            this.$el.find('input.pin_code').trigger('keyup');
        },
        // what happens when the cashier enter the right PIN
        // the default behavior is the following :
        // - if there's a user with a matching pin, put it as the active 'cashier', go to cashier mode, and return true
        // - else : do nothing and return false. You probably want to extend this to show and appropriate error popup...
        validatePIN: function(pin){
            var found_user = this.pos.db.get_cashier_by_pin(pin);
            if(found_user){
                if (this.actual_user != found_user.id){
                    this.on_session_changed(this.actual_user,found_user.id);
                    this.pos.cashier = found_user;
                    this.pos_widget.username.refresh();
                }
                return true;
            }
            return false;
        },
        on_session_changed: function(old_user, new_user){
            //TODO
        },
        /*close:function(){
            this.pos_widget.action_bar.destroy_buttons();
        },*/
    });


    // this is used to notify the user that data is being synchronized on the network
    module.LockScreenWidget = module.StatusWidget.extend({
        template: 'LockScreenWidget',
        start: function(){
            var self = this;
            this.$el.click(function(){
                self.pos_widget.screen_selector.close_popup();
                self.pos_widget.screen_selector.show_popup_overall('cashierloginpopup');
            });
        },
    });

    
    module.PoiPosCashierWidget = module.PosWidget.include({
        template: 'PosWidget',

        init: function(parent, options) {
            this._super(parent);
            var  self = this;
        },
        start: function(){
            var self = this;
            this._super().done(function(){
                //TODO: Timeout must be configured by interface
                //self.screen_selector.set_current_screen('cashierlogin');
                time_logout = self.pos.config.logout_timeout;
                if (time_logout>0){
                    time_logout = time_logout * 1000;
                }
                else
                {
                    time_logout = 30000;
                }

                if (self.pos.session_locked==false || self.pos.session_locked==undefined){
                    self.screen_selector.close_popup();
                    self.screen_selector.show_popup_overall('cashierloginpopup');
                };

                var activityTimeout = setTimeout(inActive, time_logout);

                function resetActive(){
                    $(document.body).attr('class', 'active');
                    clearTimeout(activityTimeout);
                    activityTimeout = setTimeout(inActive, time_logout);
                }

                // No activity do something.
                function inActive(){
                    if (self.pos.session_locked==false || self.pos.session_locked==undefined){
                        self.screen_selector.close_popup();
                        self.screen_selector.show_popup_overall('cashierloginpopup');
                    };
                }

                // Check for mousemove, could add other events here such as checking for key presses ect.
                $(document).bind('mousemove touchstart', function(){resetActive()});

                /*window.onblur=function(){
                    if (self.pos.session_locked==false || self.pos.session_locked==undefined){
                        self.screen_selector.close_popup();
                        self.screen_selector.show_popup_overall('cashierloginpopup');
                    };

                };*/
                //Disabled because onblur doesn't work with iPads. So......
            });
        },
        build_widgets: function() {
            var self = this;
            this._super();

            this.cashier_login_popup = new module.CashierLoginPopupWidget(this, {});
            this.cashier_login_popup.appendTo(this.$el);

            this.screen_selector.add_popup('cashierloginpopup',this.cashier_login_popup);

            this.lockscreenbutton = new module.LockScreenWidget(this,{});
            this.lockscreenbutton.appendTo(this.$('.pos-rightheader'));
        },
    });

};