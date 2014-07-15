# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#    Copyright (C) 2011-2013 Serpent Consulting Services Pvt. Ltd. (<http://serpentcs.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

import datetime
import json
import logging
import select
import time

import openerp
import openerp.tools.config
import openerp.modules.registry
from openerp import http
from openerp.http import request
from openerp.osv import osv, fields, expression
from openerp.tools.misc import DEFAULT_SERVER_DATETIME_FORMAT

_logger = logging.getLogger(__name__)

class OrderController(http.Controller):

    @http.route('/poi_pos_auth_approval/check_validate_order', type='json', auth='user')
    def check_validate_order(self, config_id=None, order_id=None, current_order=None):

        order_pool = request.registry['pos.order']

        res = {'approved': False,
               'messages': []}

        auth_pool = request.registry['pos.auth.condition']

        users_notified = []

        order_obj = order_pool.browse(request.cr, request.uid, order_id)
        print order_obj.auth_state

        res['state'] = order_obj.auth_state

        if order_obj.auth_state == 'approved':
            print "app"
            res['approved'] = True
            return res
        elif order_obj.auth_state == 'rejected':
            print "rej"
            res['approved'] = False
            res['messages'].append(order_obj.resp_note)
            return res

        if not (config_id):
            raise osv.except_osv(_('Error!'), _('There is an error with the order, this does not have a POS config valid.'))
        else:
            auth_ids = auth_pool.search(request.cr, request.uid, [('pos_config_ids', 'in', config_id)])
            if not auth_ids:
                res['approved'] = True
                return res
            else:
                #Assuming that our order is validated, this is going to change if something is not valid
                res['approved'] = True
                #We're getting all the conditions for our pos config
                for auth in auth_pool.browse(request.cr, request.uid, auth_ids):
                    auth_users_notified = []
                    server = current_order[0]['user_id']
                    for user in auth.users_notified:
                        auth_users_notified.append(user.id)

                        # If user is an authorized manager - return true
                        if user.id == current_order[0]['user_id']:
                            res['approved'] = True
                            return res

                    #We're going through condition lines
                    for condition in auth.condition_lines:
                        if condition.field_name.ttype == 'float' or condition.field_name.ttype == 'integer':
                            if order_obj.read([condition.field_name.name]):
                                value_to_compare = order_obj.read([condition.field_name.name])[0][condition.field_name.name]
                                if condition.operator == 'major':
                                    operator = '>'
                                elif condition.operator == 'minor':
                                    operator = '<'
                                elif condition.operator == 'equal' or condition.operator == 'like':
                                    operator = '='
                                elif condition.operator == 'inequal':
                                    operator = '!='
                                eval_condition = eval(str(value_to_compare) + operator + str(condition.condition_value))
                                if eval_condition:
                                    res['approved'] = False
                                    res['messages'].append(condition.message)
                                    users_notified.extend(auth_users_notified)
                        elif condition.field_name.ttype == 'many2one' or condition.field_name.ttype == 'char' or condition.field_name.ttype == 'text':
                            if order_obj.read([condition.field_name.name]):
                                if condition.field_name.ttype == 'many2one' and condition.operator != "is_not_set":
                                    if order_obj.read([condition.field_name.name])[0][condition.field_name.name]:
                                        value_to_compare = order_obj.read([condition.field_name.name])[0][condition.field_name.name][1]
                                    else:
                                        value_to_compare = order_obj.read([condition.field_name.name])[0][condition.field_name.name]

                                else:
                                    value_to_compare = order_obj.read([condition.field_name.name])[0][condition.field_name.name]

                                if condition.operator == 'equal' or condition.operator == 'major' or condition.operator == 'minor':
                                    if value_to_compare == condition.condition_value:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)
                                elif condition.operator == 'like':
                                    if value_to_compare in condition.condition_value:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)
                                elif condition.operator == 'inequal':
                                    if value_to_compare != condition.condition_value:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)
                                elif condition.operator == 'is_not_set':
                                    if not value_to_compare:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)
                                elif condition.operator == 'is_set':
                                    if value_to_compare:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)

                        elif condition.field_name.ttype == 'boolean':
                            if order_obj.read([condition.field_name.name]):
                                value_to_compare = order_obj.read([condition.field_name.name])[0][condition.field_name.name]
                                if str(condition.condition_value).upper() == 'FALSE':
                                    condition_value = False
                                else:
                                    condition_value = True
                                if condition.operator == 'equal' or condition.operator == 'major' or condition.operator == 'minor' or condition.operator == 'like':
                                    if value_to_compare == condition_value:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)
                                elif condition.operator == 'inequal':
                                    if value_to_compare != condition_value:
                                        res['approved'] = False
                                        res['messages'].append(condition.message)
                                        users_notified.extend(auth_users_notified)

        if res['messages'] and not res['approved']:
            res['users_notified'] = sorted(set(users_notified))
            res['auth_state'] = order_obj.auth_state

        return res