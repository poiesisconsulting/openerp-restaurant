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

from openerp.osv import fields, osv
import time
from openerp import netsvc, tools
from openerp.tools.translate import _

class table_area(osv.osv):
    _name = 'table.area'

    _columns = {
        'name': fields.char('Area Description', required=True, size=64),
        'table_ids': fields.one2many('table.table','area_id','Tables'),
        #Fields added to set times for tables
        'open_timer': fields.integer('Open'),
        'just_seated_timer': fields.integer('Just Seated'),
        'order_taken_timer': fields.integer('Order Taken'),
        'served_timer': fields.integer('Served'),
        'check_timer': fields.integer('Check'),
        'paid_timer': fields.integer('Paid'),
    }


class table_table(osv.osv):
    _name = 'table.table'

    _columns = {
        'name': fields.char('Description', required=True, size=64, select=1),
        'code': fields.char('Code', size=64, required=True),
        'number_of_seats':fields.integer('Number of seats'),
        'max_number_of_seats':fields.integer('Maximum number of seats'),
        #To reserve a table there must be a wizard to specify who is going to come. Maybe a res-partner?
        #Also there must be a registry to log who is the one whom reserved the table (res.user)
        #The state of the table is going to change all the time.
        'state':fields.selection([('open','Open'),
                                  ('just_seated','Just Seated'),
                                  ('order_taken','Order Taken'),
                                  ('served','Served'),
                                  ('check','Check'),
                                  ('paid','Paid')], 'State', required=True),
        'users_ids':fields.many2many('res.users', 'rel_table_table_users_rel', 'table_id', 'user_id', 'Users'),
        'order_ids':fields.many2many('pos.order', 'table_pos_order_rel', 'table_id', 'order_id', 'Orders'),
        'area_id': fields.many2one('table.area','Area', required=True),
        'only_free_state': fields.boolean('Only Free State'),
        #These fields intend to store position of the tables on the interface
        'col': fields.integer('Grid Col'),
        'row': fields.integer('Grid Row'),
        'size_x': fields.integer('Grid Size X'),
        'size_y': fields.integer('Grid Size Y'),
    }

    _defaults = {
        'state':'open',
    }


    def set_table_position(self, cr, uid, table_data):
        self.write(cr, uid, table_data.get('widget_id'), {'col': table_data.get('col'),
                                       'row': table_data.get('row'),
                                       'size_x': table_data.get('size_x'),
                                       'size_y': table_data.get('size_y')})
        return True

    def write(self, cr, uid, ids, vals, context=None):
        if context is None:
            context = {}
        if not ids:
            return True
        if vals.get('state'):
            if not isinstance(ids, list):
                ids = [ids]
            for table in self.browse(cr, uid, ids):
                if table.only_free_state:
                    super(table_table, self).write(cr, uid, table.id, {'state': 'open'}, context=context)
                    ids.remove(table.id)
                else:
                    order_pool = self.pool.get('pos.order')
                    order_ids = order_pool.search(cr, uid, ['&',('table_ids','in',ids),('state','=','draft')])
                    order_pool.write(cr, uid, order_ids, {'state_log': [[0,0,{'state': vals.get('state')}]]})
        if ids:
            return super(table_table, self).write(cr, uid, ids, vals, context=context)
        else:
            return True

class table_user(osv.osv):
    _inherit ='res.users'

    _columns = {
        'table_ids':fields.many2many('table.table', 'rel_table_table_users_rel', 'user_id', 'table_id', 'Tables'),
    }