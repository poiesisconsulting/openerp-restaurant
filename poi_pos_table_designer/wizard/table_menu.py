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

from openerp.osv import osv,fields

class table_assigner_wizard(osv.osv_memory):

    _name = 'table.menu.wizard'

    _columns = {
        'table_id': fields.many2one('table.table', 'Table'),
    }

    def default_get(self, cr, uid, fields, context=None):
        res = super(table_assigner_wizard, self).default_get(cr, uid, fields, context=context)

        if context.get('table_selected'):
            table_selected = context.get('table_selected')

            res['table_id'] = table_selected
        return res

    def free_table(self, cr, uid, ids, context=None):
        for wizard in self.browse(cr, uid, ids, context):
            wizard.table_id.write({'state': 'open'})
        return True

    def mark_as_seated(self, cr, uid, ids, context=None):
        for wizard in self.browse(cr, uid, ids, context):
            wizard.table_id.write({'state': 'just_seated'})
        return True

    def mark_as_served(self, cr, uid, ids, context=None):
        for wizard in self.browse(cr, uid, ids, context):
            wizard.table_id.write({'state': 'served'})
        return True

    def view_order(self, cr, uid, ids, context=None):
        for wizard in self.browse(cr, uid, ids, context):
            table_id= wizard.table_id.id

        order_ids = self.pool.get('pos.order').search(cr, uid, ['&',('table_ids','=',table_id),('state','=','draft')])

        if order_ids:

            return {
                    'view_type': 'form',
                    'view_mode': 'form',
                    'view_id': False,
                    'res_model': 'pos.order',
                    'domain': [],
                    'context': context,
                    'res_id': order_ids[0],
                    'type': 'ir.actions.act_window',
                    'target': 'new'
                    }

        else:
            return False

    def transfer(self, cr, uid, ids, context=None):
        for wizard in self.browse(cr, uid, ids, context):
            wizard.table_id.write({'state': 'open'})
        return True