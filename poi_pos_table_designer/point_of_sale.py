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

from openerp import SUPERUSER_ID
from openerp.osv import fields, osv
import time
from openerp import netsvc, tools
from openerp.tools.translate import _
import openerp.addons.decimal_precision as dp

class pos_order_table_state_log(osv.osv):
    _name = 'pos.order.table.state.log'
    _columns = {
        'order_id': fields.many2one('pos.order','Order'),
        'state': fields.selection([('open','Open'),
                                  ('just_seated','Just Seated'),
                                  ('order_taken','Order Taken'),
                                  ('served','Served'),
                                  ('check','Check'),
                                  ('paid','Paid')], 'State', required=True),
        'creation_date': fields.datetime('Creation Date'),
    }

    _defaults = {
        'creation_date': lambda *a: time.strftime('%Y-%m-%d %H:%M:%S'),
    }

class pos_order_line_rejected(osv.osv):
    _name = "pos.order.line.rejected"
    _description = "Lines rejected"
    _rec_name = "product_id"

    _columns = {
        'product_id': fields.many2one('product.product', 'Product', domain=[('sale_ok', '=', True)], required=True, change_default=True),
        'price_unit': fields.float(string='Unit Price', digits_compute=dp.get_precision('Account')),
        'qty': fields.float('Quantity', digits_compute=dp.get_precision('Product UoS')),
        'property_description': fields.text('Property Description'),
        'order_line_notes': fields.text('Notes'),
        'order_id': fields.many2one('pos.order', 'Order Ref', ondelete='cascade'),
    }


class pos_category(osv.osv):
    _inherit = 'product.public.category'

    _columns={
        'course_sequence': fields.integer('Course sequence', help="Precofigured course sequence in which products of this category get served."),
    }

class pos_product(osv.osv):
    _inherit = 'product.product'

    _columns={
        'course_sequence': fields.related('public_categ_id','course_sequence', string='Course sequence'),
    }


class pos_sales_promotions(osv.osv):
    _name = "pos.sales.promotions"
    _description = "Sales & Promotions"
    _rec_name = 'reason'

    _columns = {
        'reason': fields.char('Reason', size=64),
        'active': fields.boolean('Active'),
    }
    _defaults = {
        'active': True,
    }



class pos_order(osv.osv):

    _inherit = 'pos.order'

    def _get_tables_info(self, cr, uid, ids, field_names, arg=None, context=None):

        res = {}

        for order in self.browse(cr, uid, ids, context=context):
            res_data = {}
            table_str = ''
            for table in order.table_ids:
                table_str = "%s%s%s" % (table_str, (table_str != '' and ',' or ''), table.code,)
            res_data['tables'] = table_str

            cover_count = 0
            seats = []
            for line in order.lines:
                if line.seat > 0 and line.seat not in seats:
                    cover_count += 1
                    seats.append(line.seat)
            res_data['covers'] = cover_count

            res[order.id] = res_data

        return res

    def name_get(self, cr, uid, ids, context=None):
        if not ids:
            return []
        if isinstance(ids, (int, long)):
            ids = [ids]

        res = []
        for r in self.read(cr, uid, ids, ['name', 'tables']):
            res.append((r['id'], '%s (%s)' % (r['name'], r['tables'])))
        return res

    _columns = {
        'table_ids': fields.many2many("table.table", "table_pos_order_rel", "order_id", "table_id", "Tables"),
        'tables': fields.function(_get_tables_info, type='char', size=32, string='Table', store=True, multi="table_data"),
        'covers': fields.function(_get_tables_info, type='integer', string='Covers', store=True, multi="table_data"),
        'lines_rejected': fields.one2many('pos.order.line.rejected', 'order_id', 'Order Lines Rejected', states={'draft': [('readonly', False)]}, readonly=True),
        'number_of_seats': fields.integer('Number of Seats'),
        'courses': fields.integer('Number of Seats'),
        'current_course': fields.integer('Number of Seats'),
        'state_log': fields.one2many('pos.order.table.state.log', 'order_id', 'State Log'),
        'sal_prom': fields.many2one('pos.sales.promotions', 'S&P'),
        'internal_message':fields.text('Internal Message'),
    }

    def get_last_state_timestamp(self, cr, uid, ids, context=None):

        res = {}

        for order in self.browse(cr, uid, ids):
            res_temp = {'state': None, 'creation_date': None}
            for state in order.state_log:
                if state.creation_date > res_temp['creation_date']:
                    res_temp['state'] = state.state
                    res_temp['creation_date'] = state.creation_date
            res[order.id] = res_temp

        return res

    def avoid_write_fields(self, cr, uid, context = None):
        res = super(pos_order, self).avoid_write_fields(cr, uid)
        #ToDo: I'm not sure about table_ids
        res += ['state_log']
        return res


    def _fetch_create_ui_values(self, cr, uid, order, context=None):
        res = super(pos_order, self)._fetch_create_ui_values(cr, uid, order, context)

        if order.get('order_id'):
            res['order_id']=order.get('order_id')

        return res

    def fetch_sp_journal_id(self, cr, uid, context=None):

        data_obj = self.pool.get('ir.model.data')
        dummy, sp_id = data_obj.get_object_reference(cr, uid, 'poi_pos_table_designer', 'journal_sp')
        return sp_id

    def sp_execute(self, cr, uid, order_id, sp_reason, context=None):
        pos_orders = self.pool.get('pos.order')
        current_order = pos_orders.browse(cr, uid, order_id, context=context)

        if (sp_reason == 'remove' and current_order['sal_prom']) or sp_reason == 'reject_notified':
            current_order.write({
                'sal_prom': None,
                'auth_note': None,
                'auth_state': "none",
                'auth_by': None,
                'resp_note': None,
            })

        elif sp_reason == 'back':
            current_order.write({
                'auth_note': None,
                'auth_state': "none",
                'auth_by': None,
                'resp_note': None,
            })

        elif sp_reason != 'remove' and sp_reason != 'back':
            current_order.write({
                'sal_prom': sp_reason,
            })
        return True

    def sp_create_from_ui(self, cr, uid, order, context=None):
        order['amount_paid'] = order['amount_total']
        self.create_from_ui(cr, uid, [{'data': order, 'to_invoice': False}], context=None)

        return True

    def create(self, cr, uid, vals, context=None):

        if vals.get('order_id', False):
            order_id=int(vals.get('order_id'))
            del vals['order_id']
            del vals['name']
            order_lines=vals.get('lines')
            #We are removing lines.
            del vals['lines']
            if self.search(cr, uid, [('id', '=', order_id)]):
                self.write(cr, uid, [order_id], vals)
            res=order_id
        else:
            res=super(pos_order, self).create(cr, uid, vals, context)
        return res


    def create_table_order_from_ui(self, cr, uid, order_data, context=None):
        context = context or {}
        order=order_data[0]
        table_pool = self.pool.get('table.table')

        if not order.get('partner_id'):
            order['partner_id'] = False
        tables = []
        for table in order.get('table_ids'):
            table_pool.write(cr, uid, table, {'state': 'just_seated'})
            tables.append((4,table))

        order_id = self.create(cr, uid, {
            'name': order['name'],
            'user_id': order['user_id'] or False,
            'partner_id': order['partner_id'] and order['partner_id'] or False,
            'session_id': order['pos_session_id'],
            'pos_reference':order['name'],
            'table_ids': tables,
            'number_of_seats': order['number_of_seats'],
            'courses': order['courses']
        }, context)

        return order_id

    def set_order_tables_state(self, cr, uid, order_id, state, context=None):
        order_obj = self.browse(cr, uid, order_id)
        for table in order_obj.table_ids:
            table.write({'state': state})
        return True

    def reassign_tables_from_ui(self, cr, uid, order_id, order_data, context=None):
        context = context or {}
        order=order_data[0]
        table_pool = self.pool.get('table.table')

        #State by default
        new_state = 'just_seated'
        ids_to_free = []
        #Requesting old state
        for table in self.browse(cr, uid, order_id).table_ids:
            ids_to_free.append(table.id)
            if table.state != 'open':
                new_state = table.state
                #break

        #Free previous tables
        table_pool.write(cr, uid, ids_to_free, {'state': 'open'})

        tables = []
        for table in order.get('table_ids'):
            table_pool.write(cr, uid, table, {'state': new_state})
            tables.append(table)

        context['no_synch'] = True

        res = self.write(cr, uid, int(order_id), {
            'table_ids': [(6,0,tables)],
            'number_of_seats': order['number_of_seats'],
            'courses': order['courses'],
            'current_course': order['current_course'],
            'internal_message': order['internal_message'],
        }, context)

        return res

    def _fetch_orderline_values(self, cr, uid, orderline, context=None):
        res = super(pos_order, self)._fetch_orderline_values(cr, uid, orderline, context)
        values={'property_description': orderline.get('property_description') or '',
                'order_line_notes': orderline.get('order_line_notes') or '',
                'product_ids': orderline.get('product_ids'),
                'seat': orderline.get('seat'),
                'lady': orderline.get('lady'),
                'sequence': orderline.get('sequence'),
                }
        res = dict(res.items() + values.items())
        return res

    # This function was adapted from OE7.../point_of_sale_table/point_of_sale.py >> "ceate_from_ui"
    def send_to_kitchen_from_ui(self, cr, uid, orders, context=None):
        pos_line_object = self.pool.get('pos.order.line')

        if orders[0].get('data'):
            order = orders[0]['data']
        else:
            order = orders[0]

        for line in order.get('lines'):
            if line[2].get('id'):

                line_id = int(line[2].get('id'))

                if line[2].get('remove'):
                    pos_line_object.unlink(cr, uid, line_id, context=context)

                props = self.pool.get('product.product.property.id')
                prop_id = props.search(cr, uid, [('pos_orderline_id', '=', line_id)])
                del_a = []
                for p_id in prop_id:
                    del_a.append([2, p_id])
                pos_line_object.write(cr, SUPERUSER_ID, line_id, {'product_ids': del_a}, context=context)

                line_properties = {
                    'property_description': line[2].get('property_description') or '',
                    'order_line_notes': line[2].get('order_line_notes') or '',
                    'discount': line[2].get('discount'),
                    'price_unit': line[2].get('price_unit'),
                    'product_id': line[2].get('product_id'),
                    'product_ids': line[2].get('product_ids'),
                    'qty': line[2].get('qty'),
                    'seat': line[2].get('seat'),
                    'lady': line[2].get('lady'),
                    'sequence': line[2].get('sequence'),
                    'sent_to_kitchen': True
                }
                pos_line_object.write(cr, uid, line_id, line_properties, context=context)
            else:
                new_name = line[2].get('unique_name', False)
                if new_name:
                    exist_ids = pos_line_object.search(cr, uid, [('unique_name', '=', new_name), ('sent_to_kitchen', '=', True)])
                    if exist_ids:
                        #NBA. Solución temporal para evitar los duplicados
                        continue
                line_properties = {
                    'unique_name': line[2].get('unique_name') or '',
                    'property_description': line[2].get('property_description') or '',
                    'order_line_notes': line[2].get('order_line_notes') or '',
                    'discount': line[2].get('discount'),
                    'price_unit': line[2].get('price_unit'),
                    'product_id': line[2].get('product_id'),
                    'product_ids': line[2].get('product_ids'),
                    'qty': line[2].get('qty'),
                    'seat': line[2].get('seat'),
                    'lady': line[2].get('lady'),
                    'sequence': line[2].get('sequence'),
                    'order_id': order.get('order_id'),
                    'sent_to_kitchen': True,
                    'state': '1_in_queue'
                }
                pos_line_object.create(cr, uid, line_properties, context=context)

        created_order = self.browse(cr, uid, int(order.get('order_id')), context=context)
        line_ids = [line.id for line in created_order.lines]
        return [order.get('order_id'), line_ids]

    def reject_line_from_ui(self, cr, uid, orderlines, order_id, context=None):
        pos_line_rejected_object = self.pool.get('pos.order.line.rejected')

        for line in orderlines[0]:
            line_properties = {
                'product_id': line.get('product_id'),
                'price_unit': line.get('price_unit'),
                'qty': line.get('qty'),
                'property_description': line.get('property_description') or '',
                'order_line_notes': line.get('order_line_notes') or '',
                'order_id': int(order_id),
            }
            pos_line_rejected_object.create(cr, uid, line_properties, context=context)

    def remove_kitchen_from_ui(self, cr, uid, orderlines, context=None):
        pos_line_object = self.pool.get('pos.order.line')

        for line in orderlines:
            pos_line_object.unlink(cr, uid, int(line['id']), context=context)

    def edit_kitchen_from_ui(self, cr, uid, orderlines, context=None):
        pos_line_object = self.pool.get('pos.order.line')
        for line in orderlines[0]:

            line_id = int(line.get('id'))

            props = self.pool.get('product.product.property.id')
            prop_id = props.search(cr, uid, [('pos_orderline_id', '=', line_id)])
            del_a = []
            for p_id in prop_id:
                del_a.append([2, p_id])
            pos_line_object.write(cr, uid, line_id, {'product_ids': del_a}, context=context)

            line_properties = {
                'property_description': line.get('property_description') or '',
                'order_line_notes': line.get('order_line_notes') or '',
                'discount': line.get('discount'),
                'price_unit': line.get('price_unit'),
                'product_id': line.get('product_id'),
                'product_ids': line.get('product_ids'),
                'qty': line.get('qty'),
                'seat': line.get('seat'),
                'sequence': line.get('sequence'),
            }
            pos_line_object.write(cr, uid, line.get('id'), line_properties, context=context)

    def merge_orders(self, cr, uid, from_order, into_order):
        res = super(pos_order, self).merge_orders(cr, uid, from_order, into_order)
        merge_wizard_pool = self.pool.get('table.merge.wizard')
        merge_wiz_id = merge_wizard_pool.create(cr, uid, {'base_order_id': from_order,
                                           'case': 'into',
                                           'backend': False,
                                           'target_order_ids': [(0, 0,  {'order_id': into_order, 'apply': True})]})

        return merge_wizard_pool.merge_orders(cr, uid, [merge_wiz_id])

class pos_order_line_state(osv.osv):
    _name = "pos.order.line.state"

    _columns = {
        'name': fields.char('Name', size=18),
        'sequence': fields.integer('Sequence'),
    }


class ProductProductPropertyId(osv.osv):
    _name = 'product.product.property.id'
    _columns = {
        'pos_orderline_id': fields.many2one('pos.order.line', 'product_ids'),
        'property_id': fields.many2one('product.property', 'Property'),
        'product_id': fields.many2one('product.product', 'Product'),
    }

class pos_order_line(osv.osv):
    _inherit = "pos.order.line"

    _columns = {
        'flag': fields.boolean('flag'),
        'color': fields.integer('Color Index'),
        'sequence': fields.integer('Sequence'),
        'seat': fields.integer('Seat'),
        'property_description': fields.text('Property Description'),
        'product_ids': fields.one2many('product.product.property.id', 'pos_orderline_id', 'Modifiers'),
        'order_line_state_id': fields.many2one('pos.order.line.state', "Order Line State"),
        'table_ids': fields.related('order_id','table_ids', type="many2many", string="Tables",relation='table.table'),
        'order_line_notes': fields.text('Notes'),
        'sent_to_kitchen': fields.boolean('flag'),
        'lady': fields.boolean('Lady'),
    }

    def _read_group_stage_ids(self, cr, uid, ids, domain, read_group_order=None, access_rights_uid=None, context=None):
        line_stage_obj = self.pool.get('pos.order.line.state')
        result = []
        line_stage_ids = line_stage_obj.search(cr, uid, [], order='sequence', context=context)
        for line_stage in line_stage_obj.browse(cr, uid, line_stage_ids, context=context):
            result.append((line_stage.id, line_stage.name))
        return result, {}

    _group_by_full = {
        'order_line_state_id': _read_group_stage_ids,
    }

    _order = "order_id,sequence"

    def forward_change_state(self, cr, uid, ids, context = None):
        o_l_state_obj = self.pool.get("pos.order.line.state")
        for order_lint in self.browse(cr, uid, ids, context = context):
            o_l_seq = o_l_state_obj.search(cr, uid, [('sequence', '>', order_lint.order_line_state_id.sequence)])
            sequence = []
            sequence_data = []
            for state_seq in o_l_state_obj.browse(cr, uid, o_l_seq, context = context):
                sequence.append(state_seq.sequence)
                sequence_data.append({'id':state_seq.id, 'sequence': state_seq.sequence})
            if sequence and type(sequence) is list:
                sequence.sort()
                for s_d in sequence_data:
                    if(s_d.get('sequence') == sequence[0]):
#                        obj = self.pool.get('ir.model.data').get_object_reference(cr, uid, 'point_of_sale_table', 'menu_point_of_sale_order_line')[1]
                        if sequence.__len__() == 1:
                            self.write(cr, uid, order_lint.id, {'order_line_state_id':s_d.get('id')}, context = context )
#                            return {
#                                'type' : 'ir.actions.client',
#                                'name' : 'Kitchen Screen',
#                                'tag' : 'reload',
#                                'params' : {'menu_id': obj},
#                            }
                            return {
                                'name': _(''),
                                'view_type': 'kanban',
                                'view_mode': 'kanban,tree,form',
                                'res_model': 'pos.order.line',
                                'view_id': False,
                                'tag':'reload',
                                'type': 'ir.actions.act_window',
                            }
                        else:
                            self.write(cr, uid, order_lint.id, {'order_line_state_id':s_d.get('id')}, context = context )
                            return {
                                'name': _(''),
                                'view_type': 'kanban',
                                'view_mode': 'kanban,tree,form',
                                'res_model': 'pos.order.line',
                                'view_id': False,
                                'tag':'reload',
                                'type': 'ir.actions.act_window',
                            }
        return False

    def back_change_state(self, cr, uid, ids, context = None):
        o_l_state_obj = self.pool.get("pos.order.line.state")
        for order_lint in self.browse(cr, uid, ids, context = context):
            o_l_seq = o_l_state_obj.search(cr, uid, [('sequence', '<', order_lint.order_line_state_id.sequence)])
            sequence = []
            sequence_data = []
            for state_seq in o_l_state_obj.browse(cr, uid, o_l_seq, context = context):
                sequence.append(state_seq.sequence)
                sequence_data.append({'id':state_seq.id, 'sequence': state_seq.sequence})
            if sequence and type(sequence) is list:
                sequence.sort()
                sequence.reverse()
                for s_d in sequence_data:
#                    obj = self.pool.get('ir.model.data').get_object_reference(cr, uid, 'point_of_sale_table', 'menu_point_of_sale_order_line')[1]
                    if(s_d.get('sequence') == sequence[0]):
                        if sequence.__len__() == 1:
                            self.write(cr, uid, order_lint.id, {'order_line_state_id':s_d.get('id')}, context = context )
                            return {
                                'name': _(''),
                                'view_type': 'kanban',
                                'view_mode': 'kanban,tree,form',
                                'res_model': 'pos.order.line',
                                'view_id': False,
                                'tag':'reload',
                                'type': 'ir.actions.act_window',
                            }
                        else:
                            self.write(cr, uid, order_lint.id, {'order_line_state_id':s_d.get('id')}, context = context )
#                            return {
#                                'type' : 'ir.actions.client',
#                                'name' : 'Kitchen Screen',
#                                'tag' : 'reload',
#                                'params' : {'menu_id': obj},
#                            }
                            return {
                                'name': _(''),
                                'view_type': 'kanban',
                                'view_mode': 'kanban,tree,form',
                                'res_model': 'pos.order.line',
                                'view_id': False,
                                'tag':'reload',
                                'type': 'ir.actions.act_window',
                            }
        return False

    def _get_state_id(self, cr, uid, ids, context = None):
        stage_ids = self.pool.get('pos.order.line.state').search(cr, uid, [], order='sequence', context=context)
        return stage_ids and stage_ids[0] or False

    _defaults = {
        'flag':False,
        'order_line_state_id': _get_state_id
    }

class pos_config(osv.osv):
    _inherit = 'pos.config'
    _columns = {
        'kitchen_screen': fields.boolean('Edit order-lines up to kitchen status', help='Check this field only if there is a screen in the kitchen'),
    }
    _defaults = {
        'kitchen_screen': False,
    }