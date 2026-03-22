export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      categorias_item: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
        }
      }
      items: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          categoria_id: string | null
          status: 'ativo' | 'inativo'
          tem_craft: boolean
          eh_meu_produto: boolean
          eh_compravel: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          categoria_id?: string | null
          status?: 'ativo' | 'inativo'
          tem_craft?: boolean
          eh_meu_produto?: boolean
          eh_compravel?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          categoria_id?: string | null
          status?: 'ativo' | 'inativo'
          tem_craft?: boolean
          eh_meu_produto?: boolean
          eh_compravel?: boolean
          updated_at?: string
        }
      }
      item_receita: {
        Row: {
          id: string
          item_id: string
          ingrediente_id: string
          quantidade: number
        }
        Insert: {
          id?: string
          item_id: string
          ingrediente_id: string
          quantidade: number
        }
        Update: {
          quantidade?: number
        }
      }
      item_precos: {
        Row: {
          id: string
          item_id: string
          preco_sujo: number | null
          preco_limpo: number | null
          data_inicio: string
          criado_por: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          preco_sujo?: number | null
          preco_limpo?: number | null
          data_inicio: string
          criado_por?: string | null
          created_at?: string
        }
        Update: never
      }
      lojas: {
        Row: {
          id: string
          nome: string
          localizacao: string | null
          tipo: string | null
          status: 'ativo' | 'inativo'
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          localizacao?: string | null
          tipo?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
        }
        Update: {
          nome?: string
          localizacao?: string | null
          tipo?: string | null
          status?: 'ativo' | 'inativo'
        }
      }
      loja_item_precos: {
        Row: {
          id: string
          loja_id: string
          item_id: string
          preco: number
          atualizado_por: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          loja_id: string
          item_id: string
          preco: number
          atualizado_por?: string | null
          updated_at?: string
        }
        Update: {
          preco?: number
          atualizado_por?: string | null
          updated_at?: string
        }
      }
      perfis_acesso: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          created_at?: string
        }
        Update: {
          nome?: string
          descricao?: string | null
        }
      }
      perfil_permissoes: {
        Row: {
          id: string
          perfil_id: string
          modulo: string
          pode_ver: boolean
          pode_editar: boolean
        }
        Insert: {
          id?: string
          perfil_id: string
          modulo: string
          pode_ver?: boolean
          pode_editar?: boolean
        }
        Update: {
          pode_ver?: boolean
          pode_editar?: boolean
        }
      }
      usuarios: {
        Row: {
          id: string
          nome: string
          cargo: string | null
          perfil_id: string | null
          status: 'ativo' | 'inativo'
          created_at: string
        }
        Insert: {
          id: string
          nome: string
          cargo?: string | null
          perfil_id?: string | null
          status?: 'ativo' | 'inativo'
          created_at?: string
        }
        Update: {
          nome?: string
          cargo?: string | null
          perfil_id?: string | null
          status?: 'ativo' | 'inativo'
        }
      }
    }
  }
}

export type Item = Database['public']['Tables']['items']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']
export type CategoriaItem = Database['public']['Tables']['categorias_item']['Row']
export type ItemReceita = Database['public']['Tables']['item_receita']['Row']
export type ItemPreco = Database['public']['Tables']['item_precos']['Row']
export type Loja = Database['public']['Tables']['lojas']['Row']
export type LojaItemPreco = Database['public']['Tables']['loja_item_precos']['Row']
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type PerfilAcesso = Database['public']['Tables']['perfis_acesso']['Row']
export type PerfilPermissao = Database['public']['Tables']['perfil_permissoes']['Row']
