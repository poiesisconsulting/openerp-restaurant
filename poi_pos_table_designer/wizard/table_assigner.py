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

    _name = 'table.assigner.wizard'

    _columns = {
        'table_ids': fields.many2many('table.table', 'table_assigner_wizard_table_rel', 'wizard_id', 'table_id', 'Tables Assigned'),
        'number_of_seats': fields.integer('Number of Seats'),
        'partner_id': fields.many2one('res.partner','Partner'),
    }

    def assign_tables(self, cr, uid, ids, context=None):

        order_pool = self.pool.get('pos.order')

        for wizard in self.browse(cr, uid, ids):
            wizard.partner_id.id
            tables = []
            for table in wizard.table_ids:
                tables.append(table.id)
                table.write({'state': 'just_seated'})

            order_id = order_pool.create(cr, uid, {
                'user_id': uid,
                'partner_id': wizard.partner_id and wizard.partner_id.id or False,
                'session_id': uid, #ToDo check which session it's going to use.
                'table_ids': [[6, False, tables]],
                'number_of_seats': wizard.number_of_seats
            }, context)
        return True

    def default_get(self, cr, uid, fields, context=None):
        res = super(table_assigner_wizard, self).default_get(cr, uid, fields, context=context)

        if context.get('tables_selected'):
            tables_selected = context.get('tables_selected')
        if context.get('number_of_seats'):
            number_of_seats = context.get('number_of_seats')

            res['table_ids'] = tables_selected
            res['number_of_seats'] = number_of_seats

        return res